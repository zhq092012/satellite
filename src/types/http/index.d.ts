export type HttpRequestOptions = {
  baseUrl?: string
  timeout?: number
  headers?: Record<string, unknown>
}

export type AxiosResponsePage<T> = {
  code: number
  data: {
    content: T
    pageable: {
      sort: {
        sorted: boolean
        unsorted: boolean
        empty: boolean
      }
      pageNumber: number
      pageSize: number
      offset: number
      unpaged: boolean
      paged: boolean
    }
    totalElements: number
    totalPages: number
    last: boolean
    number: number
    size: number
    sort: {
      sorted: boolean
      unsorted: boolean
      empty: boolean
    }
    numberOfElements: number
    first: boolean
    empty: boolean
  }
  msg: string
}
export type AxiosResponseType<T> = {
  code: number
  data: T
  msg: string
}
