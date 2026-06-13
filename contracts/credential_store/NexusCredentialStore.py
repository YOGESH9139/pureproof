import typing

from algopy import ARC4Contract, BoxMap, Bytes, Global, UInt64, arc4, itxn, subroutine


class Credential(arc4.Struct):
    age_gte_18: arc4.Bool
    age_gte_21: arc4.Bool
    nationality_code: arc4.UInt16
    issued_at: arc4.UInt64
    expires_at: arc4.UInt64


class PublicSignals(arc4.Struct):
    nullifier: arc4.StaticArray[arc4.Byte, typing.Literal[32]]
    age_gte_18: arc4.Bool
    age_gte_21: arc4.Bool
    nationality_code: arc4.UInt16
    current_timestamp: arc4.UInt64


class NexusCredentialStore(ARC4Contract):
    def __init__(self) -> None:
        self.verifier_app_id = UInt64(0)
        self.credentials = BoxMap(Bytes, Credential, key_prefix=b"c")

    @arc4.abimethod(create="require")
    def create(self, verifier_app_id: arc4.UInt64) -> None:
        self.verifier_app_id = verifier_app_id.native

    @arc4.abimethod
    def register_credential(
        self,
        proof: arc4.DynamicBytes,
        public_signals: PublicSignals,
    ) -> arc4.Bool:
        nullifier_bytes = public_signals.nullifier.bytes
        assert nullifier_bytes not in self.credentials, "credential already exists"

        # AlgoPlonk LogicSig expects app args: selector, proof, public inputs.
        itxn.ApplicationCall(
            app_id=self.verifier_app_id,
            app_args=(b"verify", proof.bytes, public_signals.bytes),
            fee=0,
        ).submit()

        issued_at = Global.latest_timestamp
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
        if nullifier_bytes in self.credentials:
            return arc4.Bool(True), self.credentials[nullifier_bytes].copy()
        return arc4.Bool(False), empty_credential()

    @arc4.abimethod(readonly=True)
    def credential_exists(
        self, nullifier: arc4.StaticArray[arc4.Byte, typing.Literal[32]]
    ) -> arc4.Bool:
        return arc4.Bool(nullifier.bytes in self.credentials)


@subroutine
def empty_credential() -> Credential:
    return Credential(
        age_gte_18=arc4.Bool(False),
        age_gte_21=arc4.Bool(False),
        nationality_code=arc4.UInt16(0),
        issued_at=arc4.UInt64(0),
        expires_at=arc4.UInt64(0),
    )
