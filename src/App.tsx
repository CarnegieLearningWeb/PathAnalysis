import './App.css'
import { 
  // useDataShopData, 
  useLocalSampleData,
  usePathAnalysisData 
} from '@/lib/dataFetchingHooks';
import { useEffect, useState } from 'react';
import { convertDataTypesIncomingData, processPathAnalysisData, processDataShopData } from '@/lib/dataProcessingUtils';
import { GlobalDataType, GraphData } from './lib/types';
import DirectedGraph from './components/DirectedGraph';

function App() {
  const sectionId = "area_perimeter_mix_rectangle_derived";
  const problemId = "area_perimeter_mix_rectangle_derived-020";

  const { pathAnalysisData, isPathAnalysisDataLoading } = usePathAnalysisData(sectionId, problemId);
  // const { dataShopData, isDataShopDataLoading } = useDataShopData();
  const filePath = "analyzing_different_forms_of_expressions.json"
  const { localSampleData, isLocalSampleDataLoading } = useLocalSampleData(filePath)
  const [processedPathAnalysisData, setProcessedPathAnalysisData] = useState<GraphData | null>(null);
  const [processedShopData, setProcessedShopData] = useState<GraphData | null>(null);

  // useEffect( () => {
  //   if (isDataShopDataLoading) {
  //     return;
  //   }
  //   else{
  //     console.log("dataShopData: ", dataShopData);
  //   }
  // }, [isDataShopDataLoading, dataShopData])

  useEffect(() => {
    if (isLocalSampleDataLoading) {
      return;
    }
    if (localSampleData) {
      const _processData = async () => {
        const processedData = await processDataShopData(localSampleData as GlobalDataType[])
        setProcessedShopData(processedData);
      }
      _processData();
    }
  }, [isLocalSampleDataLoading, localSampleData])


  useEffect(() => {
    const _processData = async () => {
      if (pathAnalysisData) {
        setProcessedPathAnalysisData(await processPathAnalysisData(convertDataTypesIncomingData(pathAnalysisData)));
      }
    }
    _processData();

  }, [isPathAnalysisDataLoading, pathAnalysisData])

  if (isPathAnalysisDataLoading || !processedPathAnalysisData || !processedShopData) {
    return <div>Loading...</div>
  }

  return (
    <>
      <div className="p-5">
        {/* path analysis window */}

        <DirectedGraph graphData={processedShopData} />
      </div>

    </>
  )
}

export default App
