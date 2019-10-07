package models

import (
	"encoding/json"
	"errors"
	"fmt"

	"github.com/tidwall/gjson"
	null "gopkg.in/guregu/null.v3"
)

// RunResult keeps track of the outcome of a TaskRun or JobRun. It stores the
// Data and ErrorMessage, and contains a field to track the status.
type RunResult struct {
	ID              uint        `json:"-" gorm:"primary_key;auto_increment"`
	CachedJobRunID  *ID         `json:"jobRunId" gorm:"-"`
	CachedTaskRunID *ID         `json:"taskRunId" gorm:"-"`
	Data            JSON        `json:"data" gorm:"type:text"`
	Status          RunStatus   `json:"status"`
	ErrorMessage    null.String `json:"error"`
}

func RunResultComplete(resultVal interface{}) RunResult {
	var result RunResult
	result.CompleteWithResult(resultVal)
	return result
}

func RunResultError(err error) RunResult {
	var result RunResult
	result.SetError(err)
	return result
}

// String satisfies the Stringer interface for RunResult
func (rr RunResult) String() string {
	return fmt.Sprintf(`RunResult(ID: %d, Status: "%s", Data: "%s")`,
		rr.ID,
		rr.Status,
		rr.Data)
}

// CompleteWithResult saves a value to a RunResult and marks it as completed
func (rr *RunResult) CompleteWithResult(val interface{}) {
	rr.Status = RunStatusCompleted
	rr.ApplyResult(val)
}

// ApplyResult saves a value to a RunResult with the key result.
func (rr *RunResult) ApplyResult(val interface{}) {
	rr.Add("result", val)
}

// Add adds a key and result to the RunResult's JSON payload.
func (rr *RunResult) Add(key string, result interface{}) {
	data, err := rr.Data.Add(key, result)
	if err != nil {
		rr.SetError(err)
		return
	}
	rr.Data = data
}

// SetError marks the result as errored and saves the specified error message
func (rr *RunResult) SetError(err error) {
	rr.ErrorMessage = null.StringFrom(err.Error())
	rr.Status = RunStatusErrored
}

// RunResultPendingConfirmation returns a run result with pending confirmation status
func RunResultPendingConfirmation() RunResult {
	return RunResult{Status: RunStatusPendingConfirmations}
}

// MarkPendingConfirmations sets the status to pending_confirmations.
func (rr *RunResult) MarkPendingConfirmations() {
	rr.Status = RunStatusPendingConfirmations
}

// RunResultPendingConnection returns a run result with pending connection status
func RunResultPendingConnection() RunResult {
	return RunResult{Status: RunStatusPendingConnection}
}

// Get searches for and returns the JSON at the given path.
func (rr *RunResult) Get(path string) gjson.Result {
	return rr.Data.Get(path)
}

// ResultString returns the string result of the Data JSON field.
func (rr *RunResult) ResultString() (string, error) {
	val := rr.Result()
	if val.Type != gjson.String {
		return "", fmt.Errorf("non string result")
	}
	return val.String(), nil
}

// Result returns the result as a gjson object
func (rr *RunResult) Result() gjson.Result {
	return rr.Get("result")
}

// HasError returns true if the ErrorMessage is present.
func (rr *RunResult) HasError() bool {
	return rr.ErrorMessage.Valid
}

// Error returns the string value of the ErrorMessage field.
func (rr *RunResult) Error() string {
	return rr.ErrorMessage.String
}

// GetError returns the error of a RunResult if it is present.
func (rr *RunResult) GetError() error {
	if rr.HasError() {
		return errors.New(rr.ErrorMessage.ValueOrZero())
	}
	return nil
}

// Merge saves the specified result's data onto the receiving RunResult. The
// input result's data takes preference over the receivers'.
func (rr *RunResult) Merge(in RunResult) error {
	var err error
	rr.Data, err = rr.Data.Merge(in.Data)
	if err != nil {
		return err
	}
	rr.ErrorMessage = in.ErrorMessage
	rr.Status = in.Status
	return nil
}

// BridgeRunResult handles the parsing of RunResults from external adapters.
type BridgeRunResult struct {
	RunResult
	ExternalPending bool   `json:"pending"`
	AccessToken     string `json:"accessToken"`
}

// UnmarshalJSON parses the given input and updates the BridgeRunResult in the
// external adapter format.
func (brr *BridgeRunResult) UnmarshalJSON(input []byte) error {
	type biAlias BridgeRunResult
	var anon biAlias
	err := json.Unmarshal(input, &anon)
	*brr = BridgeRunResult(anon)

	if brr.Status.Errored() || brr.HasError() {
		brr.Status = RunStatusErrored
	} else if brr.ExternalPending || brr.Status.PendingBridge() {
		brr.Status = RunStatusPendingBridge
	} else {
		brr.Status = RunStatusCompleted
	}

	return err
}
