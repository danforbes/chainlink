package models

import (
	"fmt"
	"time"

	"github.com/ethereum/go-ethereum/common"
	clnull "github.com/smartcontractkit/chainlink/core/null"
	"github.com/smartcontractkit/chainlink/core/store/assets"
	null "gopkg.in/guregu/null.v3"
)

// JobRun tracks the status of a job by holding its TaskRuns and the
// Result of each Run.
type JobRun struct {
	ID             *ID          `json:"id" gorm:"primary_key;not null"`
	JobSpecID      *ID          `json:"jobId" gorm:"index;not null;type:varchar(36) REFERENCES job_specs(id)"`
	Result         RunResult    `json:"result"`
	ResultID       uint         `json:"-"`
	RunRequest     RunRequest   `json:"-"`
	RunRequestID   uint         `json:"-"`
	Status         RunStatus    `json:"status" gorm:"index"`
	TaskRuns       []TaskRun    `json:"taskRuns"`
	CreatedAt      time.Time    `json:"createdAt" gorm:"index"`
	FinishedAt     null.Time    `json:"finishedAt"`
	UpdatedAt      time.Time    `json:"updatedAt"`
	Initiator      Initiator    `json:"initiator" gorm:"association_autoupdate:false;association_autocreate:false"`
	InitiatorID    uint         `json:"-"`
	CreationHeight *Big         `json:"creationHeight"`
	ObservedHeight *Big         `json:"observedHeight"`
	Overrides      JSON         `json:"overrides"`
	DeletedAt      null.Time    `json:"-" gorm:"index"`
	Payment        *assets.Link `json:"payment,omitempty"`
}

// GetID returns the ID of this structure for jsonapi serialization.
func (jr JobRun) GetID() string {
	return jr.ID.String()
}

// GetName returns the pluralized "type" of this structure for jsonapi serialization.
func (jr JobRun) GetName() string {
	return "runs"
}

// SetID is used to set the ID of this structure when deserializing from jsonapi documents.
func (jr *JobRun) SetID(value string) error {
	return jr.ID.UnmarshalText([]byte(value))
}

// ForLogger formats the JobRun for a common formatting in the log.
func (jr JobRun) ForLogger(kvs ...interface{}) []interface{} {
	output := []interface{}{
		"job", jr.JobSpecID.String(),
		"run", jr.ID.String(),
		"status", jr.Status,
	}

	if jr.CreationHeight != nil {
		output = append(output, "creation_height", jr.CreationHeight.ToInt())
	}

	if jr.ObservedHeight != nil {
		output = append(output, "observed_height", jr.ObservedHeight.ToInt())
	}

	if jr.Result.HasError() {
		output = append(output, "job_error", jr.Result.Error())
	}

	if jr.Status == "completed" {
		output = append(output, "link_earned", jr.Payment)
	}

	return append(kvs, output...)
}

// NextTaskRunIndex returns the position of the next unfinished task
func (jr *JobRun) NextTaskRunIndex() (int, bool) {
	for index, tr := range jr.TaskRuns {
		if tr.Status.CanStart() {
			return index, true
		}
	}
	return 0, false
}

// NextTaskRun returns the next immediate TaskRun in the list
// of unfinished TaskRuns.
func (jr *JobRun) NextTaskRun() *TaskRun {
	nextTaskIndex, runnable := jr.NextTaskRunIndex()
	if runnable {
		return &jr.TaskRuns[nextTaskIndex]
	}
	return nil
}

// PreviousTaskRun returns the last task to be processed, if it exists
func (jr *JobRun) PreviousTaskRun() *TaskRun {
	index, runnable := jr.NextTaskRunIndex()
	if runnable && index > 0 {
		return &jr.TaskRuns[index-1]
	}
	return nil
}

// TasksRemain returns true if there are unfinished tasks left for this job run
func (jr *JobRun) TasksRemain() bool {
	_, runnable := jr.NextTaskRunIndex()
	return runnable
}

// SetError sets this job run to failed and saves the error message
func (jr *JobRun) SetError(err error) {
	jr.Result.ErrorMessage = null.StringFrom(err.Error())
	jr.Result.Status = RunStatusErrored
	jr.Status = jr.Result.Status
	jr.FinishedAt = null.TimeFrom(time.Now())
}

// ApplyOutput updates the JobRun's Result and Status
func (jr *JobRun) ApplyOutput(result RunOutput) error {
	jr.Result.Status = result.Status
	jr.Result.ErrorMessage = result.ErrorMessage
	jr.Result.Data = result.Data
	jr.setStatus(result.Status)
	return nil
}

// ApplyBridgeRunResult saves the input from a BridgeAdapter
func (jr *JobRun) ApplyBridgeRunResult(result BridgeRunResult) error {
	jr.Result.Status = result.Status
	jr.Result.ErrorMessage = result.ErrorMessage
	jr.Result.Data = result.Data
	jr.setStatus(result.Status)
	return nil
}

func (jr *JobRun) setStatus(status RunStatus) {
	jr.Status = status
	if jr.Status.Completed() && jr.TasksRemain() {
		jr.Status = RunStatusInProgress
	} else if jr.Status.Finished() {
		jr.FinishedAt = null.TimeFrom(time.Now())
	}
}

// JobRunsWithStatus filters passed job runs returning those that have
// the desired status, entirely in memory.
func JobRunsWithStatus(runs []JobRun, status RunStatus) []JobRun {
	rval := []JobRun{}
	for _, r := range runs {
		if r.Status == status {
			rval = append(rval, r)
		}
	}
	return rval
}

// RunRequest stores the fields used to initiate the parent job run.
type RunRequest struct {
	ID        uint `gorm:"primary_key"`
	RequestID *string
	TxHash    *common.Hash
	BlockHash *common.Hash
	Requester *common.Address
	CreatedAt time.Time
	Payment   *assets.Link
}

// NewRunRequest returns a new RunRequest instance.
func NewRunRequest() RunRequest {
	return RunRequest{CreatedAt: time.Now()}
}

// TaskRun stores the Task and represents the status of the
// Task to be ran.
type TaskRun struct {
	ID                   *ID           `json:"id" gorm:"primary_key;not null"`
	JobRunID             *ID           `json:"-" gorm:"index;not null;type:varchar(36) REFERENCES job_runs(id) ON DELETE CASCADE"`
	Result               RunResult     `json:"result"`
	ResultID             uint          `json:"-"`
	Status               RunStatus     `json:"status"`
	TaskSpec             TaskSpec      `json:"task" gorm:"association_autoupdate:false;association_autocreate:false"`
	TaskSpecID           uint          `json:"-" gorm:"index;not null REFERENCES task_specs(id)"`
	MinimumConfirmations clnull.Uint32 `json:"minimumConfirmations"`
	Confirmations        clnull.Uint32 `json:"confirmations"`
	CreatedAt            time.Time     `json:"-" gorm:"index"`
}

// String returns info on the TaskRun as "ID,Type,Status,Result".
func (tr TaskRun) String() string {
	return fmt.Sprintf("TaskRun(%v,%v,%v,%v)", tr.ID.String(), tr.TaskSpec.Type, tr.Status, tr.Result)
}

// ForLogger formats the TaskRun info for a common formatting in the log.
func (tr *TaskRun) ForLogger(kvs ...interface{}) []interface{} {
	output := []interface{}{
		"type", tr.TaskSpec.Type,
		"params", tr.TaskSpec.Params,
		"taskrun", tr.ID,
		"status", tr.Status,
	}

	if tr.Result.HasError() {
		output = append(output, "error", tr.Result.Error())
	}

	return append(kvs, output...)
}

// SetError sets this task run to failed and saves the error message
func (tr *TaskRun) SetError(err error) {
	tr.Result.ErrorMessage = null.StringFrom(err.Error())
	tr.Result.Status = RunStatusErrored
	tr.Status = tr.Result.Status
}

// ApplyBridgeRunResult updates the TaskRun's Result and Status
func (tr *TaskRun) ApplyBridgeRunResult(result BridgeRunResult) {
	tr.Result.Status = result.Status
	tr.Result.ErrorMessage = result.ErrorMessage
	tr.Result.Data = result.Data
	tr.Status = result.Status
}

// ApplyOutput updates the TaskRun's Result and Status
func (tr *TaskRun) ApplyOutput(result RunOutput) {
	tr.Result.Status = result.Status
	tr.Result.ErrorMessage = result.ErrorMessage
	tr.Result.Data = result.Data
	tr.Status = result.Status
}
