export interface State {
  items?: TaskRun[]
}

export interface NormalizedData {
  taskRuns: any[]
  result: any
}

export type TaskRunsAction = { type: 'UPSERT_JOB_RUN'; data: NormalizedData }

const INITIAL_STATE: State = { items: undefined }

export default (state: State = INITIAL_STATE, action: TaskRunsAction) => {
  switch (action.type) {
    case 'UPSERT_JOB_RUN':
      return { items: action.data.taskRuns }
    default:
      return state
  }
}
