import './App.css';
import { useEffect, useState } from 'react';
import { GlobalDataType, GraphData } from './lib/types';
import DirectedGraph from './components/DirectedGraph';
import DropZone from './components/DropZone';
import { NavBar } from './components/NavBar';

function App() {
  // TODO move to global context
  const [processedData, setProcessedData] = useState<GlobalDataType[] | null>(null)
  const [graphData, setGraphData] = useState<GraphData | null>(null)
  const [isLoading, setIsLoading] = useState<boolean>(false)

  const handleData = (data: GlobalDataType[]) => {
    setProcessedData(data)
  }

  const handleLoading = (loading: boolean) => {
    setIsLoading(loading)
  }

  useEffect(() => {
    if (processedData) {
      console.log(processedData);
    }


  }, [processedData])

  return (
    <>
      <div className="">
        <div className="">
          <NavBar />
        </div>

        <div className=" flex items-center justify-center pt-20">

          {
            isLoading ?
              <div className="absolute top-0 left-0 w-full h-full bg-gray-900 bg-opacity-50 flex items-center justify-center">
                <div className="bg-white p-4 rounded-lg">
                  <p>Loading...</p>
                </div>
              </div>
              :
              <div className="">
                <DropZone afterDrop={handleData} onLoadingChange={handleLoading} />
              </div>
          }


          {
            graphData && (
              <DirectedGraph graphData={graphData} />
            )
          }

        </div>
      </div>
    </>
  )
}

export default App
