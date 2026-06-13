package main

import (
	"context"
	"fmt"
	"log"
	"os"

	"github.com/algorand/go-algorand-sdk/v2/abi"
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
	verifierAppID := zkutil.MustUint64FromEnv("VERIFIER_APP_ID")
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

	params, err := client.SuggestedParams().Do(context.Background())
	if err != nil {
		log.Fatalf("suggested params: %v", err)
	}

	appArgs := verifierArgs(proofBytes, publicInputBytes)
	verifierTxn, err := transaction.MakeApplicationNoOpTx(
		verifierAppID,
		appArgs,
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
		log.Fatalf("make verifier app call: %v", err)
	}

	txns := make([]types.Transaction, 0, 16)
	txns = append(txns, verifierTxn)
	for i := 0; i < 15; i++ {
		budgetTxn, err := transaction.MakeApplicationNoOpTx(
			budgetAppID,
			nil,
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
			log.Fatalf("make budget app call %d: %v", i+1, err)
		}
		txns = append(txns, budgetTxn)
	}

	groupedTxns, err := transaction.AssignGroupID(txns, "")
	if err != nil {
		log.Fatalf("assign group id: %v", err)
	}
	signedGroup := make([]byte, 0)
	txID := ""
	for i, txn := range groupedTxns {
		currentTxID, signedTxn, err := crypto.SignTransaction(account.PrivateKey, txn)
		if err != nil {
			log.Fatalf("sign grouped transaction %d: %v", i, err)
		}
		if i == 0 {
			txID = currentTxID
		}
		signedGroup = append(signedGroup, signedTxn...)
	}

	log.Printf("submitting verifier call with %d pooled budget app calls", len(groupedTxns)-1)
	if _, err := client.SendRawTransaction(signedGroup).Do(context.Background()); err != nil {
		log.Fatalf("send verifier group %s: %v", txID, err)
	}

	result, err := transaction.WaitForConfirmation(client, txID, 8, context.Background())
	if err != nil {
		log.Fatalf("wait for verifier confirmation: %v", err)
	}

	fmt.Printf("Verifier accepted real proof. TxID: %s\n", txID)
	fmt.Printf("Confirmed round: %d\n", result.ConfirmedRound)
	for i, logLine := range result.Logs {
		fmt.Printf("Log %d: %x\n", i, logLine)
	}
}

func verifierArgs(proofBytes []byte, publicInputBytes []byte) [][]byte {
	method, err := abi.MethodFromSignature("verify(byte[32][],byte[32][])bool")
	if err != nil {
		log.Fatalf("verifier method signature: %v", err)
	}

	return [][]byte{
		method.GetSelector(),
		zkutil.EncodeByte32Array(proofBytes),
		zkutil.EncodeByte32Array(publicInputBytes),
	}
}
