# Nexus ID ZK Testing Runbook

This repo currently verifies the ZK circuit and compiles the Algorand contracts locally.
Live TestNet deployment needs a funded deployer mnemonic.

## 1. Build and test locally

```bash
python3 -m venv .venv
.venv/bin/python -m pip install -r requirements-zk.txt

PATH="$PWD/.tools/go/bin:$PATH" go test ./...
PATH="$PWD/.tools/go/bin:$PATH" go run circuits/setup/setup.go

cd contracts/verifier && ../../.venv/bin/puyapy NexusVerifier.py && cd ../..
cd contracts/credential_store && ../../.venv/bin/puyapy NexusCredentialStore.py && cd ../..
```

Expected result:

- `go test ./...` passes.
- `contracts/verifier/Verifier.approval.teal` and `Verifier.clear.teal` are generated.
- `contracts/credential_store/NexusCredentialStore.approval.teal` and `NexusCredentialStore.clear.teal` are generated.

## 2. Deploy the verifier app

Copy `.env.zk.example` to `.env.zk`, then set `DEPLOYER_MNEMONIC` to a funded TestNet account.

```bash
set -a
source .env.zk
set +a

PATH="$PWD/.tools/go/bin:$PATH" go run contracts/verifier/deploy.go
```

Save the printed verifier app ID into `.env.zk` as `VERIFIER_APP_ID`.

Current TestNet deployment:

```bash
VERIFIER_APP_ID=764482240
```

## 3. Deploy the credential store app

```bash
set -a
source .env.zk
set +a

PATH="$PWD/.tools/go/bin:$PATH" go run contracts/credential_store/deploy.go
```

Save the printed credential store app ID into `.env.zk` as `CREDENTIAL_STORE_APP_ID`.

Current TestNet deployment:

```bash
CREDENTIAL_STORE_APP_ID=764482816
```

## 4. Verify deployed apps

```bash
curl -fsS https://testnet-api.algonode.cloud/v2/applications/764482240 | python3 -m json.tool
curl -fsS https://testnet-api.algonode.cloud/v2/applications/764482816 | python3 -m json.tool
```

Expected result:

- Verifier app `764482240` exists with `extra-program-pages: 3`.
- Credential store app `764482816` exists.
- Credential store global state has `verifier_app_id = 764482240`.

## 5. Current ZK test boundary

The circuit proof path is tested locally with gnark PLONK in `circuits/circuit_test.go`.
The generated verifier and credential store compile to TEAL.

The repo now includes proof-submission commands:

```bash
PATH="$PWD/.tools/go/bin:$PATH" go run ./cmd/zk-deploy-budget
PATH="$PWD/.tools/go/bin:$PATH" go run ./cmd/zk-verify
PATH="$PWD/.tools/go/bin:$PATH" go run ./cmd/zk-verify-lsig
```

Current TestNet budget helper:

```bash
ZK_BUDGET_APP_ID=764483407
```

Observed result on TestNet:

- The Go command generates a real gnark/AlgoPlonk proof locally.
- The proof is 768 bytes, encoded as 24 `byte[32]` chunks.
- Public inputs are 160 bytes, encoded as 5 `byte[32]` chunks.
- Local PLONK verification succeeds before submission.
- Stateful verifier app call fails even with 15 pooled budget app calls: `dynamic cost budget exceeded`, local program cost reached `11195`.
- LogicSig verifier call also fails: `dynamic cost budget exceeded`, local program cost reached `19992`.

Conclusion: the current generated AlgoPlonk verifier for this circuit is too expensive
for a successful live TestNet verification transaction as-is. The next implementation
step is to shrink the verifier workload, most likely by reducing the circuit/public-input
shape or changing the on-chain verification strategy, then redeploying the verifier.
