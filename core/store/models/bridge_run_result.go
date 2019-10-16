package models

import (
	"encoding/json"

	null "gopkg.in/guregu/null.v3"
)

// BridgeRunResult handles the parsing of RunResults from external adapters.
type BridgeRunResult struct {
	Data            JSON        `json:"data"`
	Status          RunStatus   `json:"status"`
	ErrorMessage    null.String `json:"error"`
	ExternalPending bool        `json:"pending"`
	AccessToken     string      `json:"accessToken"`
}

// UnmarshalJSON parses the given input and updates the BridgeRunResult in the
// external adapter format.
func (brr *BridgeRunResult) UnmarshalJSON(input []byte) error {
	type biAlias BridgeRunResult
	var anon biAlias
	err := json.Unmarshal(input, &anon)
	*brr = BridgeRunResult(anon)

	if brr.Status == RunStatusErrored || brr.ErrorMessage.Valid {
		brr.Status = RunStatusErrored
	} else if brr.ExternalPending || brr.Status.PendingBridge() {
		brr.Status = RunStatusPendingBridge
	} else {
		brr.Status = RunStatusCompleted
	}

	return err
}

// HasError returns true if the status is errored or the error message is set
func (brr *BridgeRunResult) HasError() bool {
	return brr.Status == RunStatusErrored || brr.ErrorMessage.Valid
}
