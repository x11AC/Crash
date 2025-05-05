import * as d3 from 'd3';
import { useRef, useEffect } from 'react';
import _ from 'lodash';

export function StackedAreaChart({ data, causes, width, height, setSelectedCause }) {
  const svgRef = useRef();
  const tooltipRef = useRef(null);

  useEffect(() => {
    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    // Sort causes by total crashes (largest to smallest)
    const causeTotals = causes.map(cause => ({
      cause,
      total: _.sumBy(data, d => d[cause] || 0)
    })).sort((a, b) => b.total - a.total);

    const sortedCauses = causeTotals.map(d => d.cause);

    // Prepare data for stacking
    data.sort((a, b) => a.year - b.year);

    const stack = d3.stack().keys(sortedCauses);
    const series = stack(data);

    // Scales
    const xScale = d3.scaleLinear()
      .domain([d3.min(data, d => d.year), d3.max(data, d => d.year)])
      .range([50, width - 20]);

    const yScale = d3.scaleLinear()
      .domain([0, d3.max(series, s => d3.max(s, d => d[1]))])
      .range([height - 40, 20]);

    const color = d3.scaleOrdinal(d3.schemeCategory10).domain(sortedCauses);

    // Area generator
    const area = d3.area()
      .x(d => xScale(d.data.year))
      .y0(d => yScale(d[0]))
      .y1(d => yScale(d[1]))
      .curve(d3.curveBasis);

    // X-axis (every 10 years)
    const decadeTicks = d3.range(Math.ceil(xScale.domain()[0] / 10) * 10, xScale.domain()[1] + 10, 10);
    const xAxis = d3.axisBottom(xScale)
      .tickValues(d3.range(Math.ceil(xScale.domain()[0] / 10) * 10, xScale.domain()[1] + 10, 10))
      .tickFormat(d3.format('d'));

    svg.append('g')
      .attr('transform', `translate(0, ${height - 40})`)
      .call(xAxis)
      .selectAll('text')
      .style('font-size', '12px');

    // Y-axis
    const yAxis = d3.axisLeft(yScale).ticks(5);
    svg.append('g')
      .attr('transform', `translate(50, 0)`)
      .call(yAxis)
      .selectAll('text')
      .style('font-size', '12px');
    
    // Grid lines and tooltip areas
    const decadeRanges = [];
    for (let i = 0; i < decadeTicks.length - 1; i++) {
      decadeRanges.push({
        start: decadeTicks[i],
        end: decadeTicks[i + 1]
      });
    }

    // Add the last range extending to the end of the data
    if (decadeTicks.length > 0) {
      decadeRanges.push({
        start: decadeTicks[decadeTicks.length - 1],
        end: xScale.domain()[1]
      });
    }

    // Add invisible rectangles between decade lines for hover areas
    svg.selectAll('.tooltip-area')
      .data(decadeRanges)
      .join('rect')
      .attr('class', 'tooltip-area')
      .attr('x', d => xScale(d.start))
      .attr('y', 20)
      .attr('width', d => xScale(d.end) - xScale(d.start))
      .attr('height', height - 60)
      .attr('fill', 'transparent')
      .style('pointer-events', 'all') // Ensure hover events are captured
      .on('mouseover', (event, d) => {
        const startYear = Math.floor(d.start);
        const endYear = Math.floor(d.end);
        const decadeData = data.filter(d => d.year >= startYear && d.year <= endYear);
        const decadeTotals = sortedCauses.map(cause => ({
          cause,
          total: _.sumBy(decadeData, d => d[cause] || 0)
        }));

        const tooltip = d3.select(tooltipRef.current);
        const tooltipWidth = tooltip.node().offsetWidth;
        const tooltipHeight = tooltip.node().offsetHeight;

        // Get the SVG's position relative to the page
        const svgRect = svgRef.current.getBoundingClientRect();
        let x = event.clientX - svgRect.left + 10;
        let y = event.clientY - svgRect.top - tooltipHeight - 10;

        if (x + tooltipWidth > width) {
          x = event.clientX - svgRect.left - tooltipWidth - 10;
        }
        if (y < 0) {
          y = event.clientY - svgRect.top + 10;
        }

        tooltip.style('opacity', 1)
          .style('left', `${x}px`)
          .style('top', `${y}px`)
          .html(`
            <strong>${startYear}-${endYear}</strong><br/>
            ${decadeTotals.map(d => `${d.cause}: ${d.total} crashes`).join('<br/>')}
          `);
      })
      .on('mouseout', () => {
        d3.select(tooltipRef.current).style('opacity', 0);
      })
      .on('click', (event) => {
        // Prevent click events on the rectangle from blocking underlying elements
        event.stopPropagation();
      });

      // Draw areas
      svg.selectAll('.area')
      .data(series)
      .join('path')
      .attr('class', 'area')
      .attr('d', area)
      .attr('fill', d => color(d.key))
      .attr('opacity', 0.8)
      .on('click', (event, d) => {
        setSelectedCause(d.key);
      });

      // Draw grid lines at decade ticks
    svg.selectAll('.grid-line')
    .data(decadeTicks)
    .join('line')
    .attr('class', 'grid-line')
    .attr('x1', d => xScale(d))
    .attr('x2', d => xScale(d))
    .attr('y1', 20)
    .attr('y2', height - 40)
    .attr('stroke', '#ccc')
    .attr('stroke-dasharray', '4');

    // Legend
    const legend = svg.append('g')
      .attr('transform', `translate(${width - 150}, 20)`);

    sortedCauses.forEach((cause, i) => {
      legend.append('rect')
        .attr('x', 0)
        .attr('y', i * 20)
        .attr('width', 18)
        .attr('height', 18)
        .attr('fill', color(cause));

      legend.append('text')
        .attr('x', 24)
        .attr('y', i * 20 + 9)
        .attr('dy', '0.35em')
        .style('font-size', '12px')
        .text(cause);
    });

  }, [data, causes, width, height, setSelectedCause]);

  return (
    <div style={{ position: 'relative' }}>
      <svg ref={svgRef} width={width} height={height}></svg>
      <div
        ref={tooltipRef}
        className="tooltip"
        style={{
          position: 'absolute',
          background: 'rgba(0, 0, 0, 0.8)',
          color: 'white',
          padding: '5px',
          borderRadius: '5px',
          pointerEvents: 'none',
          opacity: 0,
          fontSize: '12px',
          zIndex: 10
        }}
      ></div>
    </div>
  );
}