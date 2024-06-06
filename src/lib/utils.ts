import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"
import { GlobalDataType } from "./types"
import Papa from "papaparse"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}


export function parseData(readerResult: string | ArrayBuffer | null, delimiter: "\t" | "," | "|" = "\t"): GlobalDataType[] {
  const textStr = readerResult
  const results = Papa.parse(textStr as string, {
      header: true,
      delimiter: delimiter
  })
  const array: GlobalDataType[] = results.data as GlobalDataType[]
  return array
}