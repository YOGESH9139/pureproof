package circuits

import (
	"math/big"
	"testing"

	"github.com/consensys/gnark-crypto/ecc"
	cryptomimc "github.com/consensys/gnark-crypto/ecc/bn254/fr/mimc"
	"github.com/consensys/gnark/backend"
	"github.com/consensys/gnark/test"
)

const currentTimestamp = 1781308800 // 2026-06-13T00:00:00Z

func TestPassportCircuitValidProof(t *testing.T) {
	assignment := validAssignment(t, 631152000)
	assignment.AgeGte18 = 1
	assignment.AgeGte21 = 1

	assert := test.NewAssert(t)
	assert.ProverSucceeded(&PassportAttributeCircuit{}, assignment,
		test.WithCurves(ecc.BN254),
		test.WithBackends(backend.PLONK),
	)
}

func TestPassportCircuitWrongAge(t *testing.T) {
	assignment := validAssignment(t, 1420070400)
	assignment.AgeGte18 = 1
	assignment.AgeGte21 = 0

	assert := test.NewAssert(t)
	assert.ProverFailed(&PassportAttributeCircuit{}, assignment,
		test.WithCurves(ecc.BN254),
		test.WithBackends(backend.PLONK),
	)
}

func validAssignment(t *testing.T, dateOfBirth int64) *PassportAttributeCircuit {
	t.Helper()

	passportHash := big.NewInt(12345678)
	salt := big.NewInt(99999999)

	return &PassportAttributeCircuit{
		DateOfBirth:      dateOfBirth,
		NationalityByte0: 73,
		NationalityByte1: 78,
		PassportNumHash:  passportHash,
		Salt:             salt,
		Nullifier:        mimcHash(t, passportHash, salt),
		NationalityCode:  73*256 + 78,
		CurrentTimestamp: currentTimestamp,
	}
}

func mimcHash(t *testing.T, values ...*big.Int) *big.Int {
	t.Helper()

	hasher := cryptomimc.NewMiMC()
	for _, value := range values {
		if _, err := hasher.Write(value.Bytes()); err != nil {
			t.Fatalf("write MiMC input: %v", err)
		}
	}
	return new(big.Int).SetBytes(hasher.Sum(nil))
}
