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
    'Step Name': Joi.string().allow('', null).required(),
    'Outcome': Joi.string().valid('OK', 'BUG', 'INITIAL_HINT', 'HINT_LEVEL_CHANGE', 'ERROR').required(),
  }).unknown()
);

type ValidatorResult = {
  code: string;
  message: string;
}


export function parseData(readerResult: string | ArrayBuffer | null, delimiter: string = "\t"): GlobalDataType[] | null {
  if (!readerResult) {
    console.error("No data found");
    return null;
  }

  const textStr = readerResult as string;
  const results = Papa.parse<GlobalDataType>(textStr, {
    header: true,
    delimiter: delimiter,
    skipEmptyLines: true,
  });

  if (results.errors.length > 0) {
    console.error("Parsing errors: ", results.errors);
    return null;
  }

  const array: GlobalDataType[] = results.data;
  const validated = validation.validate(array);
  // console.log("Validated res: ", validated);
  
  if (validated.error) {
    // TODO finish validation error logic
    console.error("Validation error: ", validated.error.details);
    return null;
  }
  console.log("*Array: ", array);
  return array;
}