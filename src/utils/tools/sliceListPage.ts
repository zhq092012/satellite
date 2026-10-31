/**
 * 按页码从列表中切出当前页。
 *
 * @param data 原始列表
 * @param page 当前页，从 1 开始
 * @param pageSize 每页条数
 * @returns 当前页数据
 */
export function getPageData<T>(data: T[], page: number, pageSize: number): T[] {
  return data.slice((page - 1) * pageSize, page * pageSize)
}
