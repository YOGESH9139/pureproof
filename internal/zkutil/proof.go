package zkutil

import (
	"log"
	"math/big"

	"github.com/algorand/go-algorand-sdk/v2/abi"
	"github.com/consensys/gnark-crypto/ecc"
	cryptomimc "github.com/consensys/gnark-crypto/ecc/bn254/fr/mimc"
	ap "github.com/giuliop/algoplonk"
	"github.com/giuliop/algoplonk/setup"
	"nexusid/circuits"
)

func GenerateProofBytes() ([]byte, []byte) {
	passportHash := big.NewInt(12345678)
	salt := big.NewInt(99999999)
	assignment := &circuits.PassportAttributeCircuit{
		DateOfBirth:      631152000,
		NationalityByte0: 73,
		NationalityByte1: 78,
		PassportNumHash:  passportHash,
		Salt:             salt,
		Nullifier:        mimcHash(passportHash, salt),
		AgeGte18:         1,
		AgeGte21:         1,
		NationalityCode:  73*256 + 78,
		CurrentTimestamp: 1781308800,
	}

	compiled, err := ap.Compile(&circuits.PassportAttributeCircuit{}, ecc.BN254, setup.PerpetualPowersOfTauBN254)
	if err != nil {
		log.Fatalf("compile circuit: %v", err)
	}

	verifiedProof, err := compiled.Verify(assignment)
	if err != nil {
		log.Fatalf("prove and verify locally: %v", err)
	}

	proofBytes := ap.MarshalProof(verifiedProof.Proof)
	publicInputBytes, err := ap.MarshalPublicInputs(verifiedProof.Witness)
	if err != nil {
		log.Fatalf("marshal public inputs: %v", err)
	}
	MustBeChunks("proof", proofBytes, 24)
	MustBeChunks("public inputs", publicInputBytes, 5)
	return proofBytes, publicInputBytes
}

func EncodeByte32Array(data []byte) []byte {
	chunkArrayType, err := abi.TypeOf("byte[32][]")
	if err != nil {
		log.Fatalf("byte[32][] ABI type: %v", err)
	}
	encoded, err := chunkArrayType.Encode(Chunks(data))
	if err != nil {
		log.Fatalf("encode byte[32][] chunks: %v", err)
	}
	return encoded
}

func Chunks(data []byte) [][]byte {
	if len(data)%32 != 0 {
		log.Fatalf("data length must be a multiple of 32, got %d", len(data))
	}
	out := make([][]byte, 0, len(data)/32)
	for i := 0; i < len(data); i += 32 {
		chunk := make([]byte, 32)
		copy(chunk, data[i:i+32])
		out = append(out, chunk)
	}
	return out
}

func MustBeChunks(name string, data []byte, expectedChunks int) {
	if len(data) != expectedChunks*32 {
		log.Fatalf("%s length = %d bytes, expected %d bytes", name, len(data), expectedChunks*32)
	}
}

func mimcHash(values ...*big.Int) *big.Int {
	hasher := cryptomimc.NewMiMC()
	for _, value := range values {
		if _, err := hasher.Write(value.Bytes()); err != nil {
			log.Fatalf("write MiMC input: %v", err)
		}
	}
	return new(big.Int).SetBytes(hasher.Sum(nil))
}
