package circuits

import (
	"github.com/consensys/gnark/frontend"
	"github.com/consensys/gnark/std/hash/mimc"
)

const (
	SecondsPerYear = 31557600
	AgeThreshold18 = 18 * SecondsPerYear
	AgeThreshold21 = 21 * SecondsPerYear
)

// PassportAttributeCircuit proves passport attributes without revealing passport data.
//
// MVP: Track 2 validates the passport RSA signature chain off-circuit. This circuit
// proves nullifier derivation, age threshold flags, and a two-byte nationality reveal.
type PassportAttributeCircuit struct {
	DateOfBirth      frontend.Variable
	NationalityByte0 frontend.Variable
	NationalityByte1 frontend.Variable
	PassportNumHash  frontend.Variable
	Salt             frontend.Variable

	Nullifier        frontend.Variable `gnark:",public"`
	AgeGte18         frontend.Variable `gnark:",public"`
	AgeGte21         frontend.Variable `gnark:",public"`
	NationalityCode  frontend.Variable `gnark:",public"`
	CurrentTimestamp frontend.Variable `gnark:",public"`
}

func (c *PassportAttributeCircuit) Define(api frontend.API) error {
	hasher, err := mimc.NewMiMC(api)
	if err != nil {
		return err
	}
	hasher.Write(c.PassportNumHash, c.Salt)
	api.AssertIsEqual(hasher.Sum(), c.Nullifier)

	api.AssertIsEqual(
		api.Add(api.Mul(c.NationalityByte0, 256), c.NationalityByte1),
		c.NationalityCode,
	)

	api.AssertIsBoolean(c.AgeGte18)
	api.AssertIsBoolean(c.AgeGte21)

	ageSeconds := api.Sub(c.CurrentTimestamp, c.DateOfBirth)
	assertThresholdFlag(api, ageSeconds, AgeThreshold18, c.AgeGte18)
	assertThresholdFlag(api, ageSeconds, AgeThreshold21, c.AgeGte21)

	return nil
}

func assertThresholdFlag(api frontend.API, value frontend.Variable, threshold int, flag frontend.Variable) {
	// With a true flag, require threshold <= value. With a false flag, require value < threshold.
	api.AssertIsLessOrEqual(api.Mul(flag, threshold), api.Mul(flag, value))

	notFlag := api.Sub(1, flag)
	api.AssertIsLessOrEqual(
		api.Mul(notFlag, api.Add(value, 1)),
		api.Mul(notFlag, threshold),
	)
}
