import {type ClassValue, clsx} from "clsx"
import {twMerge} from "tailwind-merge"
import {ParseResult} from "./types"
import Papa from "papaparse"
import Joi from "joi"

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs))
}


const dataSchema = Joi.array().items(
    Joi.object({
        'Time': Joi.alternatives().try(
            Joi.string(),
            Joi.number()
        ).required(),
        'Step Name': Joi.string().required(),
        'Outcome': Joi.string().required(),
        'CF (Workspace Progress Status)': Joi.string().required(),
        'Problem Name': Joi.string().required(),
        'Anon Student Id': Joi.string().required()
    })
        .unknown(true)
);

export function parseData(readerResult: string | ArrayBuffer | null, delimiter: string = ","): ParseResult {
  if (!readerResult || typeof readerResult !== 'string') {
      return {
          data: null,
          error: {
              type: 'parsing',
              details: ['Invalid input: File content is empty or invalid']
          }
      };
  }

  try {
      // Handle JSON files
      if (delimiter === '') {
          try {
              const jsonData = JSON.parse(readerResult);
              const {error, value} = dataSchema.validate(jsonData, {abortEarly: false});

              if (error) {
                  // Format validation errors directly here
                  const missingFields = new Set<string>();
                  error.details.forEach(detail => {
                      const fieldName = detail.path[detail.path.length - 1].toString();
                      missingFields.add(fieldName);
                  });

                  const message = `Validation Error: The following fields are missing from the dataset: ${Array.from(missingFields).join(', ')}`;
                  return {
                      data: null,
                      error: {
                          type: 'validation',
                          details: [message]
                      }
                  };
              }
              return {data: value};
          } catch (e) {
              return {
                  data: null,
                  error: {
                      type: 'parsing',
                      details: ['Invalid JSON format']
                  }
              };
          }
      }

      // Handle CSV/TSV files
      const parseResult = Papa.parse(readerResult, {
          header: true,
          delimiter: delimiter,
          skipEmptyLines: true,
          transformHeader: (header) => header.trim(),
          quoteChar: '"',
          escapeChar: '"',
          dynamicTyping: true,
      });

      if (parseResult.errors.length > 0) {
          return {
              data: null,
              error: {
                  type: 'parsing',
                  details: parseResult.errors.map(err => `Row ${err.row}: ${err.message}`)
              }
          };
      }

      // Validate the parsed data
      const {error, value} = dataSchema.validate(parseResult.data, {abortEarly: false});
      if (error) {
          // Format validation errors directly here
          const missingFields = new Set<string>();
          error.details.forEach(detail => {
              const fieldName = detail.path[detail.path.length - 1].toString();
              missingFields.add(fieldName);
          });

          const message = `Validation Error: The following fields are missing from the dataset: ${Array.from(missingFields).join(', ')}`;
          return {
              data: null,
              error: {
                  type: 'validation',
                  details: [message]
              }
          };
      }

      return {data: value};
  } catch (error) {
      return {
          data: null,
          error: {
              type: 'parsing',
              details: [`Unexpected error: ${error instanceof Error ? error.message : 'Unknown error'}`]
          }
      };
  }
}
