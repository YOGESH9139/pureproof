package main

import (
	"io"
	"log"
	"os"
	"path/filepath"

	"github.com/consensys/gnark-crypto/ecc"
	ap "github.com/giuliop/algoplonk"
	"github.com/giuliop/algoplonk/setup"
	"github.com/giuliop/algoplonk/verifier"
	nexus "nexusid/circuits"
)

func main() {
	circuit := nexus.PassportAttributeCircuit{}

	log.Println("compiling circuit with AlgoPlonk (BN254, PerpetualPowersOfTau)")
	compiled, err := ap.Compile(&circuit, ecc.BN254, setup.PerpetualPowersOfTauBN254)
	if err != nil {
		log.Fatalf("compile circuit: %v", err)
	}

	if err := os.MkdirAll("contracts/verifier", 0o755); err != nil {
		log.Fatalf("create verifier directory: %v", err)
	}
	verifierPath := "contracts/verifier/NexusVerifier.py"
	if err := compiled.WritePuyaPyVerifier(verifierPath, verifier.SmartContract); err != nil {
		log.Fatalf("write PuyaPy verifier: %v", err)
	}
	logicSigVerifierPath := "contracts/verifier/NexusVerifierLogicSig.py"
	if err := compiled.WritePuyaPyVerifier(logicSigVerifierPath, verifier.LogicSig); err != nil {
		log.Fatalf("write PuyaPy LogicSig verifier: %v", err)
	}

	keysDir := "circuits/setup/keys"
	if err := os.MkdirAll(keysDir, 0o755); err != nil {
		log.Fatalf("create keys directory: %v", err)
	}
	writeKey(filepath.Join(keysDir, "proving.key"), compiled.Pk)
	writeKey(filepath.Join(keysDir, "verifying.key"), compiled.Vk)

	log.Printf("wrote verifier to %s", verifierPath)
	log.Printf("wrote LogicSig verifier to %s", logicSigVerifierPath)
	log.Printf("wrote keys to %s", keysDir)
}

type writableKey interface {
	WriteTo(w io.Writer) (int64, error)
}

func writeKey(path string, key writableKey) {
	file, err := os.Create(path)
	if err != nil {
		log.Fatalf("create %s: %v", path, err)
	}
	defer file.Close()

	if _, err := key.WriteTo(file); err != nil {
		log.Fatalf("write %s: %v", path, err)
	}
}
