import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"
import { GlobalDataType } from "./types"
import Papa from "papaparse"
import Joi from "joi"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

const validation = Joi.array().items(
  Joi.object({
    'Problem Name': Joi.string().required(),
    'Step Name': Joi.string().allow('', null),
    'Outcome': Joi.string().valid('OK', 'BUG', 'INITIAL_HINT', 'HINT_LEVEL_CHANGE', 'ERROR').required(),
  }).unknown()
);

export function parseData(readerResult: string | ArrayBuffer | null, delimiter: string = "\t"): GlobalDataType[] | null {
  const textStr = readerResult
  const results = Papa.parse(textStr as string, {
    header: true,
    delimiter: delimiter
  })
  if (results.errors.length > 0) {
    console.error("error during parsing: ", results.errors)
    return null;

  }

  const array: GlobalDataType[] = results.data as GlobalDataType[]
  const { error } = validation.validate(array);
  if (error) {
    console.error(error)
    return null;
  }

  return array
}