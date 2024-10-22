import { CSVRow } from "@/Context.tsx";
import _ from 'lodash';

// Step 1: Sort by 'Anon Student Id' and 'Time', then remove duplicates based on 'Anon Student Id' and 'Problem Name'
export const sortAndDeduplicate = (data: CSVRow[]): CSVRow[] => {
    // Sort by 'Anon Student Id' and 'Time'
    const sortedData = data.sort((a, b) => {
        if (a['Anon Student Id'] === b['Anon Student Id']) {
            return new Date(a['Time']).getTime() - new Date(b['Time']).getTime();
        }
        return a['Anon Student Id']!.localeCompare(b['Anon Student Id']!);
    });

    // Remove duplicates based on 'Anon Student Id' and 'Problem Name'
    return _.uniqBy(sortedData, row => `${row['Anon Student Id']}_${row['Problem Name']}`);
};

// Step 2: Group by 'Anon Student Id' and extract first 3 and last 3 unique problem names
export const getFirstAndLast3 = (data: CSVRow[]): Record<string, { first3: string[], last3: string[] }> => {
    const perStudentProblems: Record<string, { first3: string[], last3: string[] }> = {};

    data.forEach((row) => {
        const studentId = row['Anon Student Id'];
        const problemName = row['Problem Name'];

        if (!studentId || !problemName) return;

        if (!perStudentProblems[studentId]) {
            perStudentProblems[studentId] = { first3: [], last3: [] };
        }

        const currentProblems = perStudentProblems[studentId];

        // Handle first 3 unique problem names
        if (!currentProblems.first3.includes(problemName)) {
            currentProblems.first3.push(problemName);
        }

        if (currentProblems.first3.length > 3) {
            currentProblems.first3 = currentProblems.first3.slice(0, 3);
        }

        // Handle last 3 unique problem names
        currentProblems.last3.push(problemName);
    });

    // Limit 'last3' to the last 3 unique problem names
    Object.keys(perStudentProblems).forEach(studentId => {
        const problems = perStudentProblems[studentId].last3;
        perStudentProblems[studentId].last3 = Array.from(new Set(problems)).slice(-3);
    });
    console.log(perStudentProblems)
    return perStudentProblems;
};

// Step 3: Filter rows by first 3 and last 3 problem names
export const filterRowsByProblems = (data: CSVRow[], perStudentProblems: Record<string, { first3: string[], last3: string[] }>): CSVRow[] => {
    return data.filter(row => {
        const studentId = row['Anon Student Id'];
        const problemName = row['Problem Name'];

        if (!studentId || !problemName) return false;

        const studentProblems = perStudentProblems[studentId];
        if (!studentProblems) return false;

        // Check if the problem name is in either first3 or last3
        return studentProblems.first3.includes(problemName) || studentProblems.last3.includes(problemName);
    }).map(row => {
        const studentId = row['Anon Student Id'];
        const problemName = row['Problem Name'];

        const studentProblems = perStudentProblems[studentId!];
        const isFirst = studentProblems.first3.includes(problemName!);
        const isLast = studentProblems.last3.includes(problemName!);

        // Add 'first or last' field
        return {
            ...row,
            'first or last': isFirst ? 'first' : isLast ? 'last' : ''
        };
    });
};

// Step 4: Combine first 3 and last 3 into one dataset
export const combineFirstAndLast = (originalData: CSVRow[], perStudentProblems: Record<string, { first3: string[], last3: string[] }>): CSVRow[] => {
    // Filter the original data based on matching 'Anon Student Id' and 'Problem Name'
    console.log(filterRowsByProblems(originalData, perStudentProblems))
    return filterRowsByProblems(originalData, perStudentProblems);
};
