export const toMs = {
  sec: (sec: number): number => sec * 1000,
  min: (min: number): number => min * 60000
}

export const sleep = async (timeout: number) => new Promise(res => setTimeout(res, timeout))