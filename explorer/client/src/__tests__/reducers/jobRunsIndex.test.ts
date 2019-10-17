import reducer, { State } from '../../reducers'
import { JobRunsAction } from '../../reducers/jobRuns'

const STATE = { jobRunsIndex: { items: ['replace-me'] } }

describe('reducers/jobRunsIndex', () => {
  it('returns the current state for other actions', () => {
    const action = {} as JobRunsAction
    const state = reducer(STATE, action) as State

    expect(state.jobRunsIndex).toEqual(STATE.jobRunsIndex)
  })

  describe('UPSERT_JOB_RUNS', () => {
    it('can replace items', () => {
      const jobRuns = [{ id: '9b7d791a-9a1f-4c55-a6be-b4231cf9fd4e' }]
      const data = {
        meta: {
          jobRuns: {
            data: jobRuns,
            meta: { count: 100 },
          },
        },
        entities: {},
      }
      const action = { type: 'UPSERT_JOB_RUNS', data: data } as JobRunsAction
      const state = reducer(STATE, action) as State

      expect(state.jobRunsIndex).toEqual({
        items: ['9b7d791a-9a1f-4c55-a6be-b4231cf9fd4e'],
        count: 100,
      })
    })
  })

  describe('UPSERT_JOB_RUN', () => {
    it('clears items', () => {
      const data = {
        jobRuns: {},
        meta: {
          jobRun: { meta: {} },
        },
      }
      const action = { type: 'UPSERT_JOB_RUN', data: data } as JobRunsAction
      const state = reducer(STATE, action) as State

      expect(state.jobRunsIndex).toEqual({
        items: undefined,
      })
    })
  })
})
