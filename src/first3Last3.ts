import {CSVRow} from "@/Context.tsx";


// Function to transform data for the second case (with f3l3)
export const transformDataWithF3L3 = (parsedData: CSVRow[]): CSVRow[] => {
    return parsedData.map(row => ({
        'Session Id': row['Session Id'],
        'Time': row['Time'],
        'Step Name': row['Step Name'] || 'DoneButton',
        'Outcome': row['Outcome'],
        'CF (Workspace Progress Status)': row['CF (Workspace Progress Status)'],
        'Problem Name': row['Problem Name'],
        'Anon Student Id': row['Anon Student Id']
    }));
};

// Function to sort by Session Id and Time
export const sortBySessionIdAndTime = (data: CSVRow[]): CSVRow[] => {
    return data.sort((a, b) => {
        if (a['Session Id'] === b['Session Id']) {
            return new Date(a['Time']).getTime() - new Date(b['Time']).getTime();
        }
        return a['Session Id'].localeCompare(b['Session Id']);
    });
};

// Function to sort by Anon Student Id and Time
export const sortByStudentIdAndTime = (data: CSVRow[]): CSVRow[] => {
    console.log('Before sorting:', data.length);  // Check total rows
    const sortedData = data.sort((a, b) => {
        if (a['Anon Student Id'] === b['Anon Student Id']) {
            return new Date(a['Time']).getTime() - new Date(b['Time']).getTime();
        }
        return a['Anon Student Id']!.localeCompare(b['Anon Student Id']!);
    });
    console.log('After sorting:', sortedData.length);  // Check total rows after sorting
    return sortedData;
};

// Function to group by Anon Student Id and extract first/last 3 unique problem names
export const groupByStudentId = (data: CSVRow[]): Record<string, { first3: string[], last3: string[] }> => {
    const perStudentProblems: Record<string, { first3: string[], last3: string[] }> = {};

    console.log("Total rows:", data.length);

    data.forEach((row) => {
        const studentId = row['Anon Student Id'];

        // Debugging: Log each student ID
        console.log("Processing student:", studentId);

        if (!studentId) {
            console.warn("Skipping row with missing Anon Student Id", row);
            return;  // Skip rows without a student ID
        }

        if (!perStudentProblems[studentId]) {
            perStudentProblems[studentId] = {first3: [], last3: []};
        }

        const currentProblems = perStudentProblems[studentId];

        // Check and log the problem name
        const problemName = row['Problem Name'];
        // console.log("Problem name:", problemName);

        if (!currentProblems.first3.includes(problemName!)) {
            currentProblems.first3.push(problemName!);
        }

        if (currentProblems.first3.length > 3) {
            currentProblems.first3 = currentProblems.first3.slice(0, 3);
        }

        currentProblems.last3.push(problemName!);
    });

    // Limit the 'last3' for each student
    Object.keys(perStudentProblems).forEach(studentId => {
        const problems = perStudentProblems[studentId].last3;
        perStudentProblems[studentId].last3 = Array.from(new Set(problems)).slice(-3);

        // Debugging: Log the first3 and last3 for each student
        // console.log(`Student ${studentId} - First3: ${perStudentProblems[studentId].first3}, Last3: ${perStudentProblems[studentId].last3}`);
    });

    return perStudentProblems;
};


// Function to filter rows based on first3 and last3 problem names
export const filterRowsByProblems = (data: CSVRow[], perStudentProblems: Record<string, {
    first3: string[],
    last3: string[]
}>): CSVRow[] => {
    return data.filter(row => {
        const studentId = row['Anon Student Id'];
        const problemName = row['Problem Name'];

        if (!studentId || !problemName) return false;

        const studentProblems = perStudentProblems[studentId];
        if (!studentProblems) return false;

        return studentProblems.first3.includes(problemName) || studentProblems.last3.includes(problemName);
    }).map(row => {
        const studentId = row['Anon Student Id'];
        const problemName = row['Problem Name'];

        const studentProblems = perStudentProblems[studentId!];
        const isInFirstOrLast3 = studentProblems.first3.includes(problemName!) || studentProblems.last3.includes(problemName!);

        // Add isInFirstOrLast3 flag to all matching rows
        return {
            ...row,
            isInFirstOrLast3
        };
    }).filter(row => row.isInFirstOrLast3);
};

// Step 3: Get back all rows from the original data that match the filtered rows by studentId and problemName
export const getAllMatchingRows = (originalData: CSVRow[], filteredData: CSVRow[]): CSVRow[] => {
    const matchingRows: CSVRow[] = [];

    filteredData.forEach(filteredRow => {
        const { 'Anon Student Id': studentId, 'Problem Name': problemName } = filteredRow;

        const rowsForProblem = originalData.filter(row =>
            row['Anon Student Id'] === studentId && row['Problem Name'] === problemName
        );

        matchingRows.push(...rowsForProblem);
    });
    console.log(matchingRows)
    return matchingRows;
};
