package main

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
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
	anchorAppID := zkutil.MustUint64FromEnv("ZK_BUDGET_APP_ID")

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
	proofHash := sha256.Sum256(proofBytes)
	publicInputsHash := sha256.Sum256(publicInputBytes)
	nullifier := publicInputBytes[:32]

	params, err := client.SuggestedParams().Do(context.Background())
	if err != nil {
		log.Fatalf("suggested params: %v", err)
	}

	txn, err := transaction.MakeApplicationNoOpTx(
		anchorAppID,
		[][]byte{
			[]byte("nexus_zk_mvp_anchor_v1"),
			proofHash[:],
			publicInputsHash[:],
			nullifier,
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
		log.Fatalf("make proof anchor transaction: %v", err)
	}

	txID, signedTxn, err := crypto.SignTransaction(account.PrivateKey, txn)
	if err != nil {
		log.Fatalf("sign proof anchor transaction: %v", err)
	}
	if _, err := client.SendRawTransaction(signedTxn).Do(context.Background()); err != nil {
		log.Fatalf("send proof anchor transaction %s: %v", txID, err)
	}

	result, err := transaction.WaitForConfirmation(client, txID, 8, context.Background())
	if err != nil {
		log.Fatalf("wait for proof anchor confirmation: %v", err)
	}

	fmt.Printf("MVP ZK proof anchored on TestNet. TxID: %s\n", txID)
	fmt.Printf("Confirmed round: %d\n", result.ConfirmedRound)
	fmt.Printf("Proof hash: %s\n", hex.EncodeToString(proofHash[:]))
	fmt.Printf("Public inputs hash: %s\n", hex.EncodeToString(publicInputsHash[:]))
	fmt.Printf("Nullifier: %s\n", hex.EncodeToString(nullifier))
}
