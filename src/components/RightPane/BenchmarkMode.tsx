import React, { useEffect, useRef, useState } from "react";
import * as d3 from "d3";
import { Gauge, Info, Filter } from "lucide-react";
import { ProjectMetadata } from "../../types";

interface BenchmarkModeProps {
  activeProject: ProjectMetadata | null;
}

interface ModelBenchmark {
  id: string;
  version: string;
  accuracy: number; // Y-axis
  latencyMs: number; // X-axis
  sizeKb: number; // Radius
}

export const BenchmarkMode: React.FC<BenchmarkModeProps> = ({
  activeProject,
}) => {
  const chartRef = useRef<HTMLDivElement>(null);
  const [benchmarks, setBenchmarks] = useState<ModelBenchmark[]>([]);
  const [targetDevice, setTargetDevice] = useState<"cortex-m4" | "esp32" | "wasm">("cortex-m4");

  // Generate some dummy benchmark data on mount or device change
  useEffect(() => {
    const data: ModelBenchmark[] = [
      { id: "v1", version: "Baseline INT8", accuracy: 0.85, latencyMs: targetDevice === "cortex-m4" ? 120 : targetDevice === "esp32" ? 85 : 15, sizeKb: 250 },
      { id: "v2", version: "Pruned FP32", accuracy: 0.89, latencyMs: targetDevice === "cortex-m4" ? 190 : targetDevice === "esp32" ? 140 : 25, sizeKb: 850 },
      { id: "v3", version: "Distilled INT8", accuracy: 0.88, latencyMs: targetDevice === "cortex-m4" ? 65 : targetDevice === "esp32" ? 45 : 8, sizeKb: 120 },
      { id: "v4", version: "Optimized (Current)", accuracy: 0.92, latencyMs: targetDevice === "cortex-m4" ? 95 : targetDevice === "esp32" ? 65 : 12, sizeKb: 180 },
    ];
    setBenchmarks(data);
  }, [targetDevice]);

  useEffect(() => {
    if (!chartRef.current || benchmarks.length === 0) return;

    // Clear previous chart
    d3.select(chartRef.current).selectAll("*").remove();

    const containerWidth = chartRef.current.clientWidth;
    const containerHeight = 500;
    const margin = { top: 40, right: 40, bottom: 60, left: 60 };
    const width = containerWidth - margin.left - margin.right;
    const height = containerHeight - margin.top - margin.bottom;

    const svg = d3
      .select(chartRef.current)
      .append("svg")
      .attr("width", containerWidth)
      .attr("height", containerHeight)
      .append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    // X Scale (Latency) - lower is better, but usually we plot normally
    // Let's add some padding to domains
    const xMax = d3.max(benchmarks, (d: ModelBenchmark) => d.latencyMs) || 100;
    const xMin = d3.min(benchmarks, (d: ModelBenchmark) => d.latencyMs) || 0;
    
    const xScale = d3
      .scaleLinear()
      .domain([Math.max(0, xMin - 20), xMax + 30])
      .range([0, width]);

    // Y Scale (Accuracy)
    const yMin = d3.min(benchmarks, (d: ModelBenchmark) => d.accuracy) || 0.5;
    const yMax = d3.max(benchmarks, (d: ModelBenchmark) => d.accuracy) || 1.0;
    
    const yScale = d3
      .scaleLinear()
      .domain([Math.max(0, yMin - 0.05), Math.min(1, yMax + 0.05)])
      .range([height, 0]);

    // Size Scale (Radius based on Size)
    const rScale = d3
      .scaleSqrt()
      .domain([0, d3.max(benchmarks, (d: ModelBenchmark) => d.sizeKb) || 1000])
      .range([4, 20]);

    // Grid lines
    svg
      .append("g")
      .attr("class", "grid")
      .attr("transform", `translate(0,${height})`)
      .call(
        d3.axisBottom(xScale).tickSize(-height).tickFormat(() => "")
      )
      .selectAll("line")
      .attr("stroke", "rgba(255,255,255,0.05)")
      .attr("stroke-dasharray", "2,2");

    svg
      .append("g")
      .attr("class", "grid")
      .call(
        d3.axisLeft(yScale).tickSize(-width).tickFormat(() => "")
      )
      .selectAll("line")
      .attr("stroke", "rgba(255,255,255,0.05)")
      .attr("stroke-dasharray", "2,2");

    // X Axis
    svg
      .append("g")
      .attr("transform", `translate(0,${height})`)
      .call(d3.axisBottom(xScale).ticks(6))
      .selectAll("text")
      .attr("fill", "#888");

    svg
      .append("text")
      .attr("text-anchor", "middle")
      .attr("x", width / 2)
      .attr("y", height + 40)
      .attr("fill", "#A3A3A0")
      .attr("font-size", "12px")
      .text("Inferensforsinkelse / Latency (ms)");

    // Y Axis
    svg
      .append("g")
      .call(d3.axisLeft(yScale).tickFormat(d3.format(".0%")))
      .selectAll("text")
      .attr("fill", "#888");

    svg
      .append("text")
      .attr("text-anchor", "middle")
      .attr("transform", "rotate(-90)")
      .attr("x", -height / 2)
      .attr("y", -45)
      .attr("fill", "#A3A3A0")
      .attr("font-size", "12px")
      .text("Nøyaktighet / Accuracy");

    // Tooltip
    const tooltip = d3
      .select(chartRef.current)
      .append("div")
      .style("opacity", 0)
      .attr("class", "absolute rounded-lg bg-[#111] border border-[rgba(255,255,255,0.1)] p-3 shadow-xl pointer-events-none text-xs text-white z-10")
      .style("transform", "translate(-50%, -100%)")
      .style("margin-top", "-10px");

    // Add pareto frontier line (optional, for cool effect)
    // Identify pareto optimal points (max accuracy for given latency)
    const paretoPoints = benchmarks.filter((b) => {
      // It is pareto optimal if no other point has (lower latency AND higher accuracy)
      return !benchmarks.some(other => other.latencyMs <= b.latencyMs && other.accuracy >= b.accuracy && other.id !== b.id);
    }).sort((a, b) => a.latencyMs - b.latencyMs);

    const lineGenerator = d3.line<ModelBenchmark>()
      .x(d => xScale(d.latencyMs))
      .y(d => yScale(d.accuracy))
      .curve(d3.curveMonotoneX);

    svg.append("path")
      .datum(paretoPoints)
      .attr("fill", "none")
      .attr("stroke", "#8F2BFF")
      .attr("stroke-width", 2)
      .attr("stroke-dasharray", "4,4")
      .attr("d", lineGenerator);

    // Plot Points
    const nodes = svg
      .selectAll("g.node")
      .data(benchmarks)
      .enter()
      .append("g")
      .attr("class", "node")
      .attr("transform", (d: ModelBenchmark) => `translate(${xScale(d.latencyMs)},${yScale(d.accuracy)})`);

    nodes
      .append("circle")
      .attr("r", (d: ModelBenchmark) => rScale(d.sizeKb))
      .attr("fill", (d: ModelBenchmark) => d.id === "v4" ? "#39D9E6" : "#2A2A2A")
      .attr("stroke", (d: ModelBenchmark) => d.id === "v4" ? "#fff" : "#666")
      .attr("stroke-width", 2)
      .style("opacity", 0.8)
      .style("cursor", "pointer")
      .on("mouseover", (event: MouseEvent, d: ModelBenchmark) => {
        d3.select(event.currentTarget as Element)
          .transition()
          .duration(200)
          .attr("stroke", "#fff")
          .attr("stroke-width", 3);
          
        tooltip.transition().duration(200).style("opacity", 1);
        
        const rect = chartRef.current?.getBoundingClientRect();
        const xPos = event.clientX - (rect?.left || 0);
        const yPos = event.clientY - (rect?.top || 0);
        
        tooltip
          .html(`
            <div class="font-bold mb-1">${d.version}</div>
            <div class="text-[#A3A3A0] grid grid-cols-2 gap-x-4 gap-y-1">
              <span>Nøyaktighet:</span> <span class="text-white text-right">${(d.accuracy * 100).toFixed(1)}%</span>
              <span>Latens:</span> <span class="text-white text-right">${d.latencyMs} ms</span>
              <span>Størrelse:</span> <span class="text-white text-right">${d.sizeKb} KB</span>
            </div>
          `)
          .style("left", xPos + "px")
          .style("top", yPos + "px");
      })
      .on("mouseout", (event: MouseEvent, d: ModelBenchmark) => {
        d3.select(event.currentTarget as Element)
          .transition()
          .duration(200)
          .attr("stroke", d.id === "v4" ? "#fff" : "#666")
          .attr("stroke-width", 2);
          
        tooltip.transition().duration(500).style("opacity", 0);
      });

    // Add labels
    nodes
      .append("text")
      .attr("dy", (d: ModelBenchmark) => -rScale(d.sizeKb) - 8)
      .attr("text-anchor", "middle")
      .attr("fill", (d: ModelBenchmark) => d.id === "v4" ? "#fff" : "#888")
      .attr("font-size", "10px")
      .attr("font-weight", (d: ModelBenchmark) => d.id === "v4" ? "bold" : "normal")
      .text((d: ModelBenchmark) => d.version);

    // Style axis domains
    svg.selectAll(".domain").attr("stroke", "rgba(255,255,255,0.1)");

  }, [benchmarks, targetDevice]);

  return (
    <div className="flex h-full flex-col bg-[#0D0D0C] text-white">
      {/* Header */}
      <div className="flex flex-col gap-4 border-b border-[rgba(255,255,255,0.06)] bg-[#111111] p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#39D9E6]/20 text-[#39D9E6]">
              <Gauge className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-medium text-white">Benchmark-sammenligning</h2>
              <p className="text-sm text-[#A3A3A0]">
                Visualisering av trade-offs mellom latens og nøyaktighet for ulike .tflite-versjoner.
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-[#888]" />
            <select
              value={targetDevice}
              onChange={(e) => setTargetDevice(e.target.value as any)}
              className="rounded-lg border border-[rgba(255,255,255,0.1)] bg-[#1A1A1A] px-3 py-2 text-sm text-white focus:border-[#8F2BFF] focus:outline-none"
            >
              <option value="cortex-m4">ARM Cortex-M4 (Edge)</option>
              <option value="esp32">ESP32 (IoT)</option>
              <option value="wasm">WebAssembly (Browser)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
        <div className="mx-auto max-w-5xl space-y-6">
          <div className="flex items-start gap-3 rounded-lg border border-[#8F2BFF]/20 bg-[#8F2BFF]/10 p-4 text-sm text-[#E2C2FF]">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-[#8F2BFF]" />
            <div>
              <strong>Pareto-front:</strong> Grafen viser fordelingen av de trente modellene. Modeller nærmest øvre venstre hjørne (høy nøyaktighet, lav forsinkelse) utgjør Pareto-fronten (stiplet linje). Sirkelens størrelse indikerer modellens fotavtrykk i minnet (RAM/Flash).
            </div>
          </div>

          <div className="relative rounded-xl border border-[rgba(255,255,255,0.06)] bg-[#141414] p-4">
            <div className="mb-2 text-sm font-medium text-white">Inferens vs. Nøyaktighet</div>
            <div ref={chartRef} className="relative w-full" />
          </div>
        </div>
      </div>
    </div>
  );
};
