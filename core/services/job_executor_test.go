package services_test

import (
	"testing"

	"github.com/smartcontractkit/chainlink/core/internal/cltest"
	"github.com/smartcontractkit/chainlink/core/services"
	"github.com/smartcontractkit/chainlink/core/store/models"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestJobExecutor_Execute(t *testing.T) {
	t.Parallel()

	store, cleanup := cltest.NewStore(t)
	defer cleanup()

	je := services.NewJobExecutor(store)

	j := models.NewJob()
	i := models.Initiator{Type: models.InitiatorWeb}
	j.Initiators = []models.Initiator{i}
	j.Tasks = []models.TaskSpec{
		cltest.NewTask(t, "noop"),
		cltest.NewTask(t, "nooppend"),
	}
	assert.NoError(t, store.CreateJob(&j))

	run := j.NewRun(i)
	require.NoError(t, store.CreateJobRun(&run))

	err := je.Execute(run.ID)
	require.NoError(t, err)

	run, err = store.FindJobRun(run.ID)
	require.NoError(t, err)
	assert.Equal(t, models.RunStatusPendingConfirmations, run.Status)
	require.Len(t, run.TaskRuns, 2)
	assert.Equal(t, models.RunStatusCompleted, run.TaskRuns[0].Status)
	assert.Equal(t, models.RunStatusPendingConfirmations, run.TaskRuns[1].Status)
}

func TestJobExecutor_Execute_RunNotFoundError(t *testing.T) {
	t.Parallel()

	store, cleanup := cltest.NewStore(t)
	defer cleanup()

	je := services.NewJobExecutor(store)

	err := je.Execute(models.NewID())
	require.Error(t, err)
}

func TestJobExecutor_Execute_RunNotRunnableError(t *testing.T) {
	t.Parallel()

	store, cleanup := cltest.NewStore(t)
	defer cleanup()

	je := services.NewJobExecutor(store)

	j := models.NewJob()
	i := models.Initiator{Type: models.InitiatorWeb}
	j.Initiators = []models.Initiator{i}
	j.Tasks = []models.TaskSpec{
		cltest.NewTask(t, "noop"),
	}
	assert.NoError(t, store.CreateJob(&j))

	run := j.NewRun(i)
	run.Status = models.RunStatusPendingConfirmations
	require.NoError(t, store.CreateJobRun(&run))

	err := je.Execute(run.ID)
	require.Error(t, err)
}

// FIXME: need to test this somewhere more appropriate
//func TestJobRunner_executeRun_correctlyAddsLinkEarnings(t *testing.T) {
//store, cleanup := cltest.NewStore(t)
//defer cleanup()

//j := models.NewJob()
//i := models.Initiator{Type: models.InitiatorWeb}
//j.Initiators = []models.Initiator{i}
//j.Tasks = []models.TaskSpec{
//cltest.NewTask(t, "noop"),
//}
//assert.NoError(t, store.CreateJob(&j))
//run := j.NewRun(i)
//run.Payment = assets.NewLink(1)
//require.NoError(t, store.CreateJobRun(&run))
//require.NoError(t, services.ExportedExecuteRun(&run, store))

//actual, err := store.LinkEarnedFor(&j)
//require.NoError(t, err)
//assert.Equal(t, assets.NewLink(1), actual)
//}
