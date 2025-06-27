export const delay = (ms: number, i: number = 0) =>
  new Promise((res) => setTimeout(res, ms * Math.pow(2, i)))
