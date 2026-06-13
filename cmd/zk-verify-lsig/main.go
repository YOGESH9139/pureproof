package main

import (
	"context"
	"encoding/base64"
	"fmt"
	"log"
	"os"

	"github.com/algorand/go-algorand-sdk/v2/client/v2/algod"
	"github.com/algorand/go-algorand-sdk/v2/crypto"
	"github.com/algorand/go-algorand-sdk/v2/mnemonic"
	"github.com/algorand/go-algorand-sdk/v2/transaction"
	"github.com/algorand/go-algorand-sdk/v2/types"
	"nexusid/internal/zkutil"
)

const (
	algodURL   = "https://testnet-api.algonode.cloud"
	algodToken = ""
)

func main() {
	zkutil.LoadDotEnv(".env.zk")

	deployerMnemonic := os.Getenv("DEPLOYER_MNEMONIC")
	if deployerMnemonic == "" {
		log.Fatal("DEPLOYER_MNEMONIC env var required")
	}
	budgetAppID := zkutil.MustUint64FromEnv("ZK_BUDGET_APP_ID")

	privateKey, err := mnemonic.ToPrivateKey(deployerMnemonic)
	if err != nil {
		log.Fatalf("private key from mnemonic: %v", err)
	}
	account, err := crypto.AccountFromPrivateKey(privateKey)
	if err != nil {
		log.Fatalf("account from private key: %v", err)
	}

	client, err := algod.MakeClient(algodURL, algodToken)
	if err != nil {
		log.Fatalf("algod client: %v", err)
	}

	proofBytes, publicInputBytes := zkutil.GenerateProofBytes()
	log.Printf("generated proof: %d bytes (%d chunks)", len(proofBytes), len(proofBytes)/32)
	log.Printf("generated public inputs: %d bytes (%d chunks)", len(publicInputBytes), len(publicInputBytes)/32)

	logicSigProgram := compileTEAL(client, "contracts/verifier/Verifier.teal")
	log.Printf("compiled LogicSig verifier program: %d bytes", len(logicSigProgram))

	logicSigAccount, err := crypto.MakeLogicSigAccountDelegated(logicSigProgram, nil, account.PrivateKey)
	if err != nil {
		log.Fatalf("make delegated LogicSig account: %v", err)
	}

	params, err := client.SuggestedParams().Do(context.Background())
	if err != nil {
		log.Fatalf("suggested params: %v", err)
	}

	txn, err := transaction.MakeApplicationNoOpTx(
		budgetAppID,
		[][]byte{
			[]byte("verify"),
			zkutil.EncodeByte32Array(proofBytes),
			zkutil.EncodeByte32Array(publicInputBytes),
		},
		nil,
		nil,
		nil,
		params,
		account.Address,
		nil,
		types.Digest{},
		[32]byte{},
		types.Address{},
	)
	if err != nil {
		log.Fatalf("make LogicSig verifier transaction: %v", err)
	}

	txID, signedTxn, err := crypto.SignLogicSigAccountTransaction(logicSigAccount, txn)
	if err != nil {
		log.Fatalf("sign LogicSig verifier transaction: %v", err)
	}

	if _, err := client.SendRawTransaction(signedTxn).Do(context.Background()); err != nil {
		log.Fatalf("send LogicSig verifier transaction %s: %v", txID, err)
	}

	result, err := transaction.WaitForConfirmation(client, txID, 8, context.Background())
	if err != nil {
		log.Fatalf("wait for LogicSig verifier confirmation: %v", err)
	}

	fmt.Printf("LogicSig verifier accepted real proof. TxID: %s\n", txID)
	fmt.Printf("Confirmed round: %d\n", result.ConfirmedRound)
}

func compileTEAL(client *algod.Client, path string) []byte {
	source, err := os.ReadFile(path)
	if err != nil {
		log.Fatalf("read %s: %v", path, err)
	}
	result, err := client.TealCompile(source).Do(context.Background())
	if err != nil {
		log.Fatalf("compile %s: %v", path, err)
	}
	program, err := base64.StdEncoding.DecodeString(result.Result)
	if err != nil {
		log.Fatalf("decode compiled %s: %v", path, err)
	}
	return program
}
