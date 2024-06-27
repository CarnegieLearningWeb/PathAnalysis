import './App.css';
import { useContext, useEffect, useState } from 'react';
import { GlobalDataType, GraphData } from './lib/types';
import DirectedGraph from './components/DirectedGraph';
import DropZone from './components/DropZone';
// import { NavBar } from './components/NavBar';
import { Button } from './components/ui/button';
import { Context } from './Context';
import { processDataShopData } from './lib/dataProcessingUtils';
import {filterPromGrad} from "@/lib/GradPromUtils";

function App() {

  const { resetData, setGraphData, setLoading, setFilteredData, filteredData, data, setData, graphData, loading } = useContext(Context)
  const [showDropZone, setShowDropZone] = useState<boolean>(true)

  const handleData = (data: GlobalDataType[]) => {
    setData(data)
    setShowDropZone(false)
  }

  const handleLoading = (loading: boolean) => {
    setLoading(loading)
  }

  const filterData = (filteredData: GlobalDataType[]) => {
    const data: GlobalDataType[] = filterPromGrad(filteredData, "PROMOTED")
    setFilteredData(data)
    console.log(data)
  }

  // const handleFilteredData = (filteredData: GlobalDataType[]) => {
  //     setData(filteredData)
  //     setShowDropZone(false)
  //     const graphData: GraphData = processDataShopData(filteredData)
  //     setGraphData(graphData)
  // }

  useEffect(() => {
    if (data) {
      const graphData: GraphData = processDataShopData(data)
      setGraphData(graphData)
    }
    // if (filteredData) {
    //   const graphData: GraphData = processDataShopData(filteredData)
    //   setGraphData(graphData)
    // }
  }, [data])  //,filteredData

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
        <div style={{position:"relative"}}>
            <div style={{position:"absolute", float: "right", top:-260, right:600}}>
                <Button

                onClick={() => {
                filterData(data!);
                setFilteredData(data);
                // handleFilteredData(filteredData!)
                }
                }> Filter Promoted Data </Button>
            </div>
        </div>
        </div>
      </div>
    </>
  )
}

export default App
