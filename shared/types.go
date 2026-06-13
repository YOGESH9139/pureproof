package shared

type PublicSignals struct {
	Nullifier        [32]byte
	AgeGte18         bool
	AgeGte21         bool
	NationalityCode  [2]byte
	CurrentTimestamp int64
}

type Credential struct {
	AgeGte18        bool
	AgeGte21        bool
	NationalityCode [2]byte
	IssuedAt        int64
	ExpiresAt       int64
}
