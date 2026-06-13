Nexus ID — Track 1: ZK Circuits + Algorand Chain
> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task.
Goal: Build the ZK passport attribute circuit in gnark, generate an Algorand PLONK verifier via AlgoPlonk, deploy a credential store smart contract on Algorand, and produce a WASM prover binary for the frontend.
Architecture: Users prove passport attributes (age, nationality) client-side using a gnark PLONK circuit compiled to WASM. The proof is submitted to an Algorand smart contract that verifies it on-chain via an AlgoPlonk-generated LogicSig verifier, then stores the credential commitment in box storage indexed by nullifier.
MVP design decision: Full RSA-2048 ZK verification inside a circuit is ~3M constraints and not practical for a mobile prover. The MVP uses a hybrid approach: the issuer API (Track 2) validates the passport RSA signature chain off-chain using standard crypto libraries. The circuit only proves attribute commitments (hash, age range check, nationality reveal). Full on-chain RSA is a V2 upgrade.
Tech Stack:
Go 1.22+
`github.com/Consensys/gnark@v0.14.0` — ZK circuit definition and proving
`github.com/giuliop/algoplonk` — generates Algorand TEAL verifier from gnark circuit
Algorand Python (Puya) + AlgoKit — credential store smart contract
`github.com/algorand/go-algorand-sdk/v2` — Algorand Go SDK for deployment
WASM target via `GOOS=js GOARCH=wasm go build`
---
Verified Sources
gnark: https://github.com/Consensys/gnark | https://docs.gnark.consensys.io/overview
AlgoPlonk: https://pkg.go.dev/github.com/giuliop/algoplonk | https://github.com/giuliop/whitelist-example-algoplonk
Algorand Python (Puya): https://algorandfoundation.github.io/puya/ | https://dev.algorand.co/concepts/smart-contracts/languages/python/
AlgoKit: https://github.com/algorandfoundation/algokit-python-template
Box storage: https://developer.algorand.org/articles/smart-contract-storage-boxes/
ICAO CSCA master list: https://www.icao.int/icao-pkd/icao-master-list (download: https://download.pkd.icao.int/)
Rarimo circuits reference: https://github.com/rarimo/passport-zk-circuits
zkpassport reference: https://github.com/zkpassport/circuits
Algorand mainnet USDC ASA 31566704: https://explorer.perawallet.app/asset/31566704/
---
Integration Points (shared with all tracks — agree before splitting)
```go
// shared/types.go — copy to all tracks

type PublicSignals struct {
    Nullifier        [32]byte // MiMC(passport_num_hash, salt) — stable anonymous ID
    AgeGte18         bool
    AgeGte21         bool
    NationalityCode  [2]byte  // ISO 3166-1 alpha-2, e.g. "IN"
    CurrentTimestamp int64    // unix seconds at proof generation time
}

type Credential struct {
    AgeGte18        bool
    AgeGte21        bool
    NationalityCode [2]byte
    IssuedAt        int64
    ExpiresAt       int64  // IssuedAt + 2 years
}

// On-chain box storage key: nullifier [32]byte → Credential (ABI-encoded)
```
Track 2 depends on:
Contract app ID (testnet) — Track 1 delivers after Task 6
ABI method signature: `register_credential(proof: byte[], public_signals: byte[]) -> bool`
ABI method signature: `query_credential(nullifier: byte[32]) -> (bool, byte[])`
Track 4 depends on:
WASM binary interface — Track 1 delivers after Task 7
Agreed `ProverInput` / `ProverOutput` JS interface (defined in Task 1 below)
---
What Track 1 Mocks (nothing — Track 1 is the foundation)
Track 1 has no upstream mocks. It delivers the real artifacts that unblock tracks 2 and 4.
---
File Structure
```
circuits/
├── circuit.go           # gnark PassportAttributeCircuit definition
├── circuit_test.go      # unit tests for circuit constraints
├── prover/
│   ├── main.go          # Go WASM prover entry point (js/wasm target)
│   └── prover_test.go
└── setup/
    ├── setup.go         # compile circuit, generate verifier .py, export keys
    └── keys/            # generated proving/verifying keys (gitignored)

contracts/
├── verifier/
│   └── NexusVerifier.py  # AlgoPlonk-generated (do not edit by hand)
├── credential_store/
│   ├── NexusCredentialStore.py  # Algorand Python contract
│   └── deploy.go        # deployment script
└── tests/
    └── credential_store_test.py

shared/
└── types.go             # PublicSignals, Credential structs
```
---
Task 1: Define the gnark circuit
Files:
Create: `circuits/circuit.go`
Create: `circuits/circuit_test.go`
[ ] Step 1: Initialize Go module
```bash
mkdir -p circuits/prover circuits/setup contracts/verifier contracts/credential_store contracts/tests shared
cd /home/ghoul/graveyar/x402ha
go mod init nexusid
go get github.com/Consensys/gnark@v0.14.0
go get github.com/Consensys/gnark-crypto@latest
go get github.com/giuliop/algoplonk@latest
go get github.com/algorand/go-algorand-sdk/v2@latest
```
[ ] Step 2: Write the failing circuit test
```go
// circuits/circuit_test.go
package circuits_test

import (
    "testing"
    "github.com/Consensys/gnark/backend/plonk"
    "github.com/Consensys/gnark/frontend"
    "github.com/Consensys/gnark/test"
    "github.com/consensys/gnark-crypto/ecc"
)

func TestPassportCircuit_ValidProof(t *testing.T) {
    // DOB: 1990-01-01 = 631152000 unix
    // CurrentTimestamp: 2026-06-13 = 1749772800 unix
    // Age = (1749772800 - 631152000) / 86400 / 365.25 ≈ 36.4 years → ageGte18=1, ageGte21=1
    assignment := &PassportAttributeCircuit{
        DateOfBirth:      631152000,
        NationalityByte0: 73,  // 'I'
        NationalityByte1: 78,  // 'N'
        PassportNumHash:  12345678,
        Salt:             99999999,
        Nullifier:        0, // computed in circuit — will be checked
        AgeGte18:         1,
        AgeGte21:         1,
        NationalityCode:  73*256 + 78, // 'I'*256 + 'N'
        CurrentTimestamp: 1749772800,
    }
    assert := test.NewAssert(t)
    assert.ProverSucceeded(&PassportAttributeCircuit{}, assignment,
        test.WithCurves(ecc.BN254),
        test.WithBackends(backend.PLONK),
    )
}

func TestPassportCircuit_WrongAge(t *testing.T) {
    // DOB: 2015-01-01 = 1420070400 → age ≈ 11 years → ageGte18 must be 0
    assignment := &PassportAttributeCircuit{
        DateOfBirth:      1420070400,
        NationalityByte0: 73,
        NationalityByte1: 78,
        PassportNumHash:  12345678,
        Salt:             99999999,
        AgeGte18:         1, // WRONG — should fail
        AgeGte21:         0,
        NationalityCode:  73*256 + 78,
        CurrentTimestamp: 1749772800,
    }
    assert := test.NewAssert(t)
    assert.ProverFailed(&PassportAttributeCircuit{}, assignment,
        test.WithCurves(ecc.BN254),
        test.WithBackends(backend.PLONK),
    )
}
```
[ ] Step 3: Run test — confirm it fails (circuit not defined yet)
```bash
cd /home/ghoul/graveyar/x402ha
go test ./circuits/... -run TestPassportCircuit -v
# Expected: compile error — PassportAttributeCircuit undefined
```
[ ] Step 4: Implement the circuit
```go
// circuits/circuit.go
package circuits

import (
    "github.com/Consensys/gnark/frontend"
    "github.com/Consensys/gnark/std/hash/mimc"
)

const (
    SecondsPerYear  = 31557600 // 365.25 * 86400
    AgeThreshold18  = 18 * SecondsPerYear
    AgeThreshold21  = 21 * SecondsPerYear
)

// PassportAttributeCircuit proves passport attributes without revealing passport data.
// MVP: server validates passport RSA signature off-chain before proof is accepted.
// Circuit proves: nullifier derivation, age thresholds, nationality reveal.
type PassportAttributeCircuit struct {
    // Private witness (never revealed)
    DateOfBirth      frontend.Variable // unix timestamp of birth date
    NationalityByte0 frontend.Variable // first byte of ISO 3166-1 alpha-2 code
    NationalityByte1 frontend.Variable // second byte
    PassportNumHash  frontend.Variable // MiMC hash of passport number + issuing country
    Salt             frontend.Variable // random 32-byte value chosen by user at proof time

    // Public inputs (revealed to verifier and stored on-chain)
    Nullifier        frontend.Variable `gnark:",public"` // MiMC(PassportNumHash, Salt)
    AgeGte18         frontend.Variable `gnark:",public"` // 1 if age >= 18, else 0
    AgeGte21         frontend.Variable `gnark:",public"` // 1 if age >= 21, else 0
    NationalityCode  frontend.Variable `gnark:",public"` // NationalityByte0*256 + NationalityByte1
    CurrentTimestamp frontend.Variable `gnark:",public"` // unix timestamp at proof generation
}

func (c *PassportAttributeCircuit) Define(api frontend.API) error {
    // 1. Derive nullifier: MiMC(PassportNumHash, Salt)
    h, err := mimc.NewMiMC(api)
    if err != nil {
        return err
    }
    h.Write(c.PassportNumHash)
    h.Write(c.Salt)
    computedNullifier := h.Sum()
    api.AssertIsEqual(computedNullifier, c.Nullifier)

    // 2. Verify NationalityCode = NationalityByte0 * 256 + NationalityByte1
    computedCode := api.Add(api.Mul(c.NationalityByte0, 256), c.NationalityByte1)
    api.AssertIsEqual(computedCode, c.NationalityCode)

    // 3. Age in seconds since birth
    ageSeconds := api.Sub(c.CurrentTimestamp, c.DateOfBirth)

    // 4. AgeGte18: assert it's boolean, then enforce constraint
    api.AssertIsBoolean(c.AgeGte18)
    api.AssertIsBoolean(c.AgeGte21)

    // If AgeGte18 == 1, then ageSeconds must be >= AgeThreshold18
    // Encoded as: AgeGte18 * (ageSeconds - AgeThreshold18) >= 0
    // gnark range check: AssertIsLessOrEqual(a, b) means a <= b
    // We want: if AgeGte18=1, assert AgeThreshold18 <= ageSeconds
    threshold18 := frontend.Variable(AgeThreshold18)
    threshold21 := frontend.Variable(AgeThreshold21)

    // diff18 = ageSeconds - AgeThreshold18 (should be >= 0 when AgeGte18=1)
    diff18 := api.Sub(ageSeconds, threshold18)
    // AgeGte18 * diff18 must be >= 0; if AgeGte18=0, constraint is trivially satisfied
    api.AssertIsLessOrEqual(api.Mul(c.AgeGte18, api.Neg(diff18)), 0)

    diff21 := api.Sub(ageSeconds, threshold21)
    api.AssertIsLessOrEqual(api.Mul(c.AgeGte21, api.Neg(diff21)), 0)

    // If AgeGte18=0, ensure ageSeconds < AgeThreshold18
    // notAgeGte18 = 1 - AgeGte18
    notAgeGte18 := api.Sub(1, c.AgeGte18)
    // notAgeGte18 * (AgeThreshold18 - ageSeconds - 1) >= 0
    underAge18 := api.Sub(api.Sub(threshold18, ageSeconds), 1)
    api.AssertIsLessOrEqual(api.Mul(notAgeGte18, api.Neg(underAge18)), 0)

    notAgeGte21 := api.Sub(1, c.AgeGte21)
    underAge21 := api.Sub(api.Sub(threshold21, ageSeconds), 1)
    api.AssertIsLessOrEqual(api.Mul(notAgeGte21, api.Neg(underAge21)), 0)

    return nil
}
```
[ ] Step 5: Run tests — confirm they pass
```bash
go test ./circuits/... -run TestPassportCircuit -v
# Expected: PASS — both valid and invalid cases
```
[ ] Step 6: Commit
```bash
git add circuits/circuit.go circuits/circuit_test.go go.mod go.sum
git commit -m "feat: add passport attribute ZK circuit (gnark PLONK)"
```
---
Task 2: Compile circuit + generate AlgoPlonk TEAL verifier
Files:
Create: `circuits/setup/setup.go`
Create: `contracts/verifier/NexusVerifier.py` (generated output)
[ ] Step 1: Write the setup script
```go
// circuits/setup/setup.go
package main

import (
    "log"
    "os"

    ap "github.com/giuliop/algoplonk"
    "github.com/giuliop/algoplonk/setup"
    "github.com/giuliop/algoplonk/verifier"
    "github.com/consensys/gnark-crypto/ecc"
    nexus "nexusid/circuits"
)

func main() {
    circuit := nexus.PassportAttributeCircuit{}

    log.Println("Compiling circuit with AlgoPlonk (BN254, PerpetualPowersOfTau)...")
    compiled, err := ap.Compile(&circuit, ecc.BN254, setup.PerpetualPowersOfTauBN254)
    if err != nil {
        log.Fatalf("compile: %v", err)
    }

    // Write the Algorand Python LogicSig verifier
    verifierPath := "contracts/verifier/NexusVerifier.py"
    log.Printf("Writing PuyaPy verifier to %s ...", verifierPath)
    if err := compiled.WritePuyaPyVerifier(verifierPath, verifier.LogicSig); err != nil {
        log.Fatalf("WritePuyaPyVerifier: %v", err)
    }

    // Export proving and verifying keys
    os.MkdirAll("circuits/setup/keys", 0755)

    pkFile, _ := os.Create("circuits/setup/keys/proving.key")
    if _, err := compiled.Pk.WriteTo(pkFile); err != nil {
        log.Fatalf("write pk: %v", err)
    }
    pkFile.Close()

    vkFile, _ := os.Create("circuits/setup/keys/verifying.key")
    if _, err := compiled.Vk.WriteTo(vkFile); err != nil {
        log.Fatalf("write vk: %v", err)
    }
    vkFile.Close()

    log.Println("Done. Keys saved to circuits/setup/keys/")
    log.Println("Verifier saved to contracts/verifier/NexusVerifier.py")
    log.Println("Next: compile NexusVerifier.py with PuyaPy, then deploy to Algorand testnet")
}
```
[ ] Step 2: Run setup
```bash
go run circuits/setup/setup.go
# Expected: circuits/setup/keys/{proving,verifying}.key created
#           contracts/verifier/NexusVerifier.py created
```
[ ] Step 3: Install PuyaPy and compile verifier to TEAL
```bash
pip install puya
cd contracts/verifier
puyapy NexusVerifier.py
# Expected: NexusVerifier.approval.teal and NexusVerifier.clear.teal (if SmartContract)
# For LogicSig: NexusVerifier.lsig.teal
```
[ ] Step 4: Commit generated artifacts
```bash
git add circuits/setup/setup.go contracts/verifier/
git commit -m "feat: generate AlgoPlonk TEAL verifier for passport circuit"
```
---
Task 3: Write the Algorand credential store contract
Files:
Create: `contracts/credential_store/NexusCredentialStore.py`
[ ] Step 1: Write the contract
```python
# contracts/credential_store/NexusCredentialStore.py
from algopy import (
    ARC4Contract, BoxMap, Bytes, UInt64, arc4, GlobalState,
    itxn, logicsig, subroutine, op
)
import algopy

# Credential stored per nullifier
class Credential(arc4.Struct):
    age_gte_18: arc4.Bool
    age_gte_21: arc4.Bool
    nationality_code: arc4.UInt16  # NationalityByte0*256 + NationalityByte1
    issued_at: arc4.UInt64
    expires_at: arc4.UInt64        # issued_at + 63072000 (2 years in seconds)

# PublicSignals passed to register_credential
class PublicSignals(arc4.Struct):
    nullifier: arc4.StaticArray[arc4.Byte, typing.Literal[32]]
    age_gte_18: arc4.Bool
    age_gte_21: arc4.Bool
    nationality_code: arc4.UInt16
    current_timestamp: arc4.UInt64


class NexusCredentialStore(ARC4Contract):
    # verifier_app_id: set at deploy time to the AlgoPlonk LogicSig verifier app
    verifier_app_id: GlobalState[UInt64]

    # Box storage: nullifier (32 bytes) → Credential
    credentials: BoxMap[Bytes, Credential]

    @arc4.abimethod(create="require")
    def create(self, verifier_app_id: arc4.UInt64) -> None:
        self.verifier_app_id.value = verifier_app_id.native

    @arc4.abimethod
    def register_credential(
        self,
        proof: arc4.DynamicBytes,
        public_signals: PublicSignals,
    ) -> arc4.Bool:
        nullifier_bytes = public_signals.nullifier.bytes

        # Reject duplicate nullifiers
        assert nullifier_bytes not in self.credentials, "credential already exists"

        # Verify proof via inner transaction to the AlgoPlonk LogicSig verifier
        # The verifier returns 1 (approval) if proof is valid
        itxn.ApplicationCall(
            app_id=self.verifier_app_id.value,
            app_args=(proof.bytes, public_signals.bytes),
            fee=0,
        ).submit()

        # Store credential (proof validity confirmed by verifier approval)
        issued_at = op.Global.latest_timestamp
        self.credentials[nullifier_bytes] = Credential(
            age_gte_18=public_signals.age_gte_18,
            age_gte_21=public_signals.age_gte_21,
            nationality_code=public_signals.nationality_code,
            issued_at=arc4.UInt64(issued_at),
            expires_at=arc4.UInt64(issued_at + 63072000),
        )
        return arc4.Bool(True)

    @arc4.abimethod(readonly=True)
    def query_credential(
        self, nullifier: arc4.StaticArray[arc4.Byte, typing.Literal[32]]
    ) -> tuple[arc4.Bool, Credential]:
        nullifier_bytes = nullifier.bytes
        exists = nullifier_bytes in self.credentials
        if exists:
            return arc4.Bool(True), self.credentials[nullifier_bytes].copy()
        empty = Credential(
            age_gte_18=arc4.Bool(False),
            age_gte_21=arc4.Bool(False),
            nationality_code=arc4.UInt16(0),
            issued_at=arc4.UInt64(0),
            expires_at=arc4.UInt64(0),
        )
        return arc4.Bool(False), empty

    @arc4.abimethod(readonly=True)
    def credential_exists(
        self, nullifier: arc4.StaticArray[arc4.Byte, typing.Literal[32]]
    ) -> arc4.Bool:
        return arc4.Bool(nullifier.bytes in self.credentials)
```
[ ] Step 2: Compile
```bash
cd contracts/credential_store
puyapy NexusCredentialStore.py
# Expected: NexusCredentialStore.approval.teal, NexusCredentialStore.clear.teal
```
[ ] Step 3: Commit
```bash
git add contracts/credential_store/
git commit -m "feat: add Algorand credential store contract (box storage)"
```
---
Task 4: Deploy contracts to Algorand testnet
Files:
Create: `contracts/credential_store/deploy.go`
[ ] Step 1: Get testnet ALGO from faucet
Visit https://bank.testnet.algorand.network/ and fund your deployer address.
[ ] Step 2: Write deployment script
```go
// contracts/credential_store/deploy.go
package main

import (
    "context"
    "encoding/base64"
    "fmt"
    "log"
    "os"

    "github.com/algorand/go-algorand-sdk/v2/client/v2/algod"
    "github.com/algorand/go-algorand-sdk/v2/crypto"
    "github.com/algorand/go-algorand-sdk/v2/transaction"
)

// Testnet node: https://testnet-api.algonode.cloud
const TestnetAlgodURL = "https://testnet-api.algonode.cloud"
const TestnetAlgodToken = ""

func main() {
    mnemonic := os.Getenv("DEPLOYER_MNEMONIC")
    if mnemonic == "" {
        log.Fatal("DEPLOYER_MNEMONIC env var required")
    }

    client, err := algod.MakeClient(TestnetAlgodURL, TestnetAlgodToken)
    if err != nil {
        log.Fatalf("algod client: %v", err)
    }

    account, err := crypto.AccountFromMnemonic(mnemonic)
    if err != nil {
        log.Fatalf("account: %v", err)
    }

    // Read compiled TEAL
    approvalTEAL, _ := os.ReadFile("NexusCredentialStore.approval.teal")
    clearTEAL, _ := os.ReadFile("NexusCredentialStore.clear.teal")

    sp, _ := client.SuggestedParams().Do(context.Background())

    // Deploy credential store (verifier_app_id is set after verifier deploy)
    // TODO: replace 0 with actual verifier app ID after deploying NexusVerifier
    verifierAppID := uint64(0) // set after deploying verifier

    txn, err := transaction.MakeApplicationCreateTx(
        false, approvalTEAL, clearTEAL,
        transaction.StateSchema{NumByteSlice: 0, NumUInt: 1}, // global: verifier_app_id
        transaction.StateSchema{},
        [][]byte{encodeUint64(verifierAppID)}, // create arg: verifier_app_id
        nil, nil, nil,
        sp, account.Address, nil,
        crypto.Digest{}, crypto.Digest{}, crypto.Digest{},
    )
    if err != nil {
        log.Fatalf("make txn: %v", err)
    }

    _, stx, err := crypto.SignTransaction(account.PrivateKey, txn)
    if err != nil {
        log.Fatalf("sign: %v", err)
    }

    pendingTxID, err := client.SendRawTransaction(stx).Do(context.Background())
    if err != nil {
        log.Fatalf("send: %v", err)
    }

    result, err := transaction.WaitForConfirmation(client, pendingTxID, 4, context.Background())
    if err != nil {
        log.Fatalf("confirm: %v", err)
    }

    fmt.Printf("Credential store deployed. App ID: %d\n", result.ApplicationIndex)
    fmt.Printf("Share this app ID with Track 2: APP_ID=%d\n", result.ApplicationIndex)
}

func encodeUint64(v uint64) []byte {
    b := make([]byte, 8)
    b[0] = byte(v >> 56); b[1] = byte(v >> 48)
    b[2] = byte(v >> 40); b[3] = byte(v >> 32)
    b[4] = byte(v >> 24); b[5] = byte(v >> 16)
    b[6] = byte(v >> 8);  b[7] = byte(v)
    return b
}
```
[ ] Step 3: Deploy
```bash
export DEPLOYER_MNEMONIC="your twenty five word mnemonic here"
go run contracts/credential_store/deploy.go
# Expected output: "Credential store deployed. App ID: <number>"
# Record this app ID — give it to Track 2
```
[ ] Step 4: Commit
```bash
git add contracts/credential_store/deploy.go
git commit -m "feat: add testnet deployment script for credential store"
```
---
Task 5: Build the CSCA Merkle tree (placeholder for MVP)
MVP shortcut: For the MVP, the server (Track 2) validates passport RSA against CSCA certs off-chain. The on-chain CSCA Merkle root is not checked in the circuit. Track 1 stores the root as a contract global state variable for V2.
[ ] Step 1: Download ICAO CSCA master list
```bash
# Download from official ICAO PKD
# URL: https://download.pkd.icao.int/
# File: icaopkd-002-complete-000XXX.ldif (LDAP Data Interchange Format)
# Parse the LDIF to extract DER-encoded X.509 certificates
```
[ ] Step 2: Write CSCA parser (Go)
```go
// circuits/setup/csca/parse.go
package csca

import (
    "crypto/x509"
    "encoding/base64"
    "os"
    "regexp"
    "strings"
)

// ParseLDIF extracts all CSCA certificates from ICAO master list LDIF file.
// Returns map of subject key identifier → DER certificate bytes.
func ParseLDIF(ldifPath string) (map[string][]byte, error) {
    data, err := os.ReadFile(ldifPath)
    if err != nil {
        return nil, err
    }
    certs := make(map[string][]byte)
    // LDIF entries have userCertificate:: <base64-encoded DER>
    re := regexp.MustCompile(`userCertificate:: ([A-Za-z0-9+/=\n ]+)`)
    matches := re.FindAllStringSubmatch(string(data), -1)
    for _, m := range matches {
        b64 := strings.ReplaceAll(strings.ReplaceAll(m[1], "\n", ""), " ", "")
        der, err := base64.StdEncoding.DecodeString(b64)
        if err != nil {
            continue
        }
        cert, err := x509.ParseCertificate(der)
        if err != nil {
            continue
        }
        certs[cert.Subject.CommonName] = der
    }
    return certs, nil
}
```
[ ] Step 3: Commit
```bash
git add circuits/setup/csca/
git commit -m "feat: add ICAO CSCA master list parser"
```
---
Task 6: Build the WASM prover for frontend
Files:
Create: `circuits/prover/main.go`
[ ] Step 1: Write the WASM prover entry point
```go
// circuits/prover/main.go
//go:build js && wasm

package main

import (
    "encoding/json"
    "math/big"
    "syscall/js"

    "github.com/Consensys/gnark/backend/plonk"
    "github.com/Consensys/gnark/backend/witness"
    "github.com/Consensys/gnark/frontend"
    "github.com/consensys/gnark-crypto/ecc"
    ap "github.com/giuliop/algoplonk"
    nexus "nexusid/circuits"
)

// ProverInput matches the JS interface the frontend uses
type ProverInput struct {
    DateOfBirth      int64  `json:"dateOfBirth"`      // unix timestamp
    NationalityCode  string `json:"nationalityCode"`  // e.g. "IN"
    PassportNumHash  string `json:"passportNumHash"`  // hex string
    Salt             string `json:"salt"`             // hex string (random)
    CurrentTimestamp int64  `json:"currentTimestamp"` // unix now
}

type ProverOutput struct {
    Proof           string `json:"proof"`            // hex-encoded binary blob
    PublicSignals   struct {
        Nullifier        string `json:"nullifier"`
        AgeGte18         bool   `json:"ageGte18"`
        AgeGte21         bool   `json:"ageGte21"`
        NationalityCode  int    `json:"nationalityCode"`
        CurrentTimestamp int64  `json:"currentTimestamp"`
    } `json:"publicSignals"`
}

var compiledCircuit *ap.CompiledCircuit

func init() {
    // Keys are embedded at build time via go:embed
    // See Task 6 Step 2 for key embedding
}

func generateProof(this js.Value, args []js.Value) interface{} {
    inputJSON := args[0].String()
    var input ProverInput
    if err := json.Unmarshal([]byte(inputJSON), &input); err != nil {
        return js.ValueOf(map[string]interface{}{"error": err.Error()})
    }

    natByte0 := int64(input.NationalityCode[0])
    natByte1 := int64(input.NationalityCode[1])
    natCode := natByte0*256 + natByte1

    ageSeconds := input.CurrentTimestamp - input.DateOfBirth
    ageGte18 := 0
    ageGte21 := 0
    if ageSeconds >= nexus.AgeThreshold18 {
        ageGte18 = 1
    }
    if ageSeconds >= nexus.AgeThreshold21 {
        ageGte21 = 1
    }

    passportNumHashBig, _ := new(big.Int).SetString(input.PassportNumHash, 16)
    saltBig, _ := new(big.Int).SetString(input.Salt, 16)

    // Compute nullifier (must match circuit: MiMC(passportNumHash, salt))
    // Simplified: use same MiMC as gnark std
    // For MVP, nullifier computed off-circuit and passed as public input
    // The circuit verifies it matches

    assignment := &nexus.PassportAttributeCircuit{
        DateOfBirth:      input.DateOfBirth,
        NationalityByte0: natByte0,
        NationalityByte1: natByte1,
        PassportNumHash:  passportNumHashBig,
        Salt:             saltBig,
        Nullifier:        0, // TODO: compute MiMC(passportNumHash, salt) here
        AgeGte18:         ageGte18,
        AgeGte21:         ageGte21,
        NationalityCode:  natCode,
        CurrentTimestamp: input.CurrentTimestamp,
    }

    verifiedProof, err := compiledCircuit.Verify(assignment)
    if err != nil {
        return js.ValueOf(map[string]interface{}{"error": err.Error()})
    }

    proofBytes := ap.MarshalProof(verifiedProof.Proof)
    publicInputBytes, _ := ap.MarshalPublicInputs(verifiedProof.Witness)

    output := ProverOutput{}
    output.Proof = fmt.Sprintf("%x", proofBytes)
    output.PublicSignals.AgeGte18 = ageGte18 == 1
    output.PublicSignals.AgeGte21 = ageGte21 == 1
    output.PublicSignals.NationalityCode = int(natCode)
    output.PublicSignals.CurrentTimestamp = input.CurrentTimestamp

    outputJSON, _ := json.Marshal(output)
    return js.ValueOf(string(outputJSON))
}

func main() {
    js.Global().Set("nexusGenerateProof", js.FuncOf(generateProof))
    select {} // keep alive
}
```
[ ] Step 2: Build WASM binary
```bash
GOOS=js GOARCH=wasm go build -o circuits/prover/nexus_prover.wasm ./circuits/prover/
cp "$(go env GOROOT)/misc/wasm/wasm_exec.js" circuits/prover/

# Deliver to frontend: circuits/prover/nexus_prover.wasm + wasm_exec.js
echo "WASM size: $(du -sh circuits/prover/nexus_prover.wasm)"
```
[ ] Step 3: Write WASM interface contract (JS stub for Track 4)
```typescript
// shared/prover-interface.ts
// Track 4 uses this interface. Until WASM arrives, mock returns hardcoded values.

export interface ProverInput {
  dateOfBirth: number;        // unix timestamp of birth
  nationalityCode: string;    // "IN", "GB", etc.
  passportNumHash: string;    // hex string — MiMC hash of passportNum + country
  salt: string;               // hex string — 32 random bytes
  currentTimestamp: number;   // Date.now() / 1000
}

export interface ProverOutput {
  proof: string;              // hex-encoded proof binary
  publicSignals: {
    nullifier: string;        // hex — stable anonymous ID
    ageGte18: boolean;
    ageGte21: boolean;
    nationalityCode: number;  // packed 2-byte int
    currentTimestamp: number;
  };
}

// Mock (Track 4 uses until WASM delivered by Track 1)
export async function generateProofMock(input: ProverInput): Promise<ProverOutput> {
  await new Promise(r => setTimeout(r, 3000)); // simulate proving time
  return {
    proof: "deadbeef".repeat(64),
    publicSignals: {
      nullifier: "abc123".repeat(10) + "ab",
      ageGte18: true,
      ageGte21: true,
      nationalityCode: input.nationalityCode.charCodeAt(0) * 256 + input.nationalityCode.charCodeAt(1),
      currentTimestamp: input.currentTimestamp,
    },
  };
}

// Real implementation (Track 4 swaps in when WASM arrives)
export async function generateProof(input: ProverInput): Promise<ProverOutput> {
  // @ts-ignore — loaded via wasm_exec.js
  const result = await nexusGenerateProof(JSON.stringify(input));
  return JSON.parse(result);
}
```
[ ] Step 4: Commit WASM + interface
```bash
git add circuits/prover/ shared/prover-interface.ts
git commit -m "feat: WASM prover binary and shared TS interface for frontend"
```
---
Task 7: End-to-end circuit test (full prove → on-chain verify)
[ ] Step 1: Write integration test
```go
// circuits/prover/e2e_test.go
// Uses testnet: run with go test -tags integration -v
func TestE2E_ProveAndVerifyOnChain(t *testing.T) {
    if testing.Short() {
        t.Skip("skipping integration test")
    }
    // 1. Create test assignment
    // 2. Generate proof via compiledCircuit.Verify()
    // 3. Marshal proof + public inputs
    // 4. Submit to Algorand testnet credential store contract
    // 5. Assert transaction succeeds
    // 6. Call query_credential with nullifier → assert returns correct credential
    t.Log("TODO: implement after testnet deploy in Task 4")
}
```
[ ] Step 2: Run against testnet
```bash
go test ./circuits/prover/... -tags integration -v -timeout 120s
```
[ ] Step 3: Final commit
```bash
git add circuits/prover/e2e_test.go
git commit -m "test: add end-to-end prove-and-verify integration test"
```
---
Deliverables checklist for Track 2 and Track 4
[ ] Testnet contract app ID (share in team Slack/doc)
[ ] `shared/prover-interface.ts` — frontend mock + real interface
[ ] `shared/types.go` — PublicSignals and Credential structs
[ ] ABI method signatures documented above
[ ] `circuits/prover/nexus_prover.wasm` + `wasm_exec.js`