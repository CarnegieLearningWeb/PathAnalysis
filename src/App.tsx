import './App.css';
import { useContext, useEffect, useState } from 'react';
import { GlobalDataType, GraphData } from './lib/types';
import DirectedGraph from './components/DirectedGraph';
import DropZone from './components/DropZone';
// import { NavBar } from './components/NavBar';
import { Button } from './components/ui/button';
import { Context } from './Context';
import { processDataShopData } from './lib/dataProcessingUtils';

function App() {

  const { resetData, setGraphData, setLoading, data, setData, graphData, loading } = useContext(Context)
  const [showDropZone, setShowDropZone] = useState<boolean>(true)

  const handleData = (data: GlobalDataType[]) => {
    setData(data)
    setShowDropZone(false)
  }

  const handleLoading = (loading: boolean) => {
    setLoading(loading)
  }

  useEffect(() => {
    if (data) {
      const graphData: GraphData = processDataShopData(data)
      setGraphData(graphData)

    }
  }, [data])

  return (
    <>
      <div className="">
        {/* <NavBar /> */}
        <Button
          className="m-2"
          variant={"ghost"}
          onClick={() => {
            resetData()
            setShowDropZone(true)
          }}
        >
          Reset
        </Button>

        <div className=" flex items-center justify-center pt-20">

          {
            loading ?
              <div className="absolute top-0 left-0 w-full h-full bg-gray-900 bg-opacity-50 flex items-center justify-center">
                <div className="bg-white p-4 rounded-lg">
                  <p>Loading...</p>
                </div>
              </div>
              :
              (
                showDropZone && (
                  <div className="">
                    <DropZone afterDrop={handleData} onLoadingChange={handleLoading} />
                  </div>
                )

              )

          }


          {
            graphData && (
              <>
                {/* Add suspense, lazy? */}
                <DirectedGraph graphData={graphData} />
              </>
            )
          }

        </div>
      </div>
    </>
  )
}

export default App
