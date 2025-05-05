import * as d3 from 'd3';
import { useRef, useEffect } from 'react';

export function Treemap({ data, width, height, showLegend = false, legendWidth = 200, legendHeight = 20 }) {
  const svgRef = useRef();
  const legendRef = useRef(null);
  const tooltipRef = useRef(null);

  useEffect(() => {
    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const root = d3.hierarchy(data)
      .sum(d => d.crashes || 0)
      .sort((a, b) => b.value - a.value);

    const treemap = d3.treemap()
      .size([width, height])
      .padding(2)
      .round(true);

    treemap(root);

    const fatalityExtent = d3.extent(root.leaves(), d => d.data.fatalities);
    const color = d3.scaleSequential(d3.interpolateReds).domain(fatalityExtent);

    // Render leaves (the "Survivors Present" and "No Survivors" nodes)
    svg.selectAll('.leaf')
      .data(root.leaves())
      .join('rect')
      .attr('class', 'leaf')
      .attr('x', d => d.x0)
      .attr('y', d => d.y0)
      .attr('width', d => d.x1 - d.x0)
      .attr('height', d => d.y1 - d.y0)
      .attr('fill', d => color(d.data.fatalities))
      .attr('stroke', '#fff')
      .attr('stroke-width', 1)
      .on('mouseover', (event, d) => {
        const pathParts = d.ancestors().reverse();
        const path = pathParts
          .filter(a => a.data.name !== 'Root')
          .map(a => {
            if (a.data.name === 'Yes') return 'Survivors Present';
            if (a.data.name === 'No') return 'No Survivors';
            return a.data.name;
          })
          .join(' → ');

        const tooltip = d3.select(tooltipRef.current);
        const tooltipWidth = tooltip.node().offsetWidth;
        const tooltipHeight = tooltip.node().offsetHeight;

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
            <strong>${path}</strong><br/>
            Crashes: ${d.data.crashes}<br/>
            Fatalities: ${d.data.fatalities}
          `);
      })
      .on('mouseout', () => {
        d3.select(tooltipRef.current).style('opacity', 0);
      });

    // Render leaf labels ("Survivors Present" or "No Survivors")
    svg.selectAll('.leaf-label')
      .data(root.leaves())
      .join('text')
      .attr('class', 'leaf-label')
      .attr('x', d => d.x0 + 5) // Top-left corner with padding
      .attr('y', d => d.y0 + 15) // Top-left corner with padding
      .text(d => {
        if (d.data.name === 'Yes') return 'Survivors Present';
        if (d.data.name === 'No') return 'No Survivors';
        return d.data.name;
      })
      .style('font-size', '10px')
      .style('font-weight', 'bold')
      .style('fill', 'black')
      .style('paint-order', 'stroke')
      .style('stroke', 'white')
      .style('stroke-width', '2px')
      .style('pointer-events', 'none');

    // Render parent rectangles (grouping "Survivors Present" and "No Survivors" for each crash site)
    const parents = root.descendants().filter(d => d.depth === 1);
    svg.selectAll('.parent-rect')
      .data(parents)
      .join('rect')
      .attr('class', 'parent-rect')
      .attr('x', d => d.x0)
      .attr('y', d => d.y0)
      .attr('width', d => d.x1 - d.x0)
      .attr('height', d => d.y1 - d.y0)
      .attr('fill', 'none')
      .attr('stroke', '#000')
      .attr('stroke-width', 2);

    // Render parent labels with black bold text and white background
    svg.selectAll('.parent-label')
      .data(parents)
      .join('text')
      .attr('class', 'parent-label')
      .attr('x', d => (d.x0 + d.x1) / 2)
      .attr('y', d => (d.y0 + d.y1) / 2)
      .attr('text-anchor', 'middle')
      .text(d => d.data.name)
      .style('font-size', '12px')
      .style('font-weight', 'bold')
      .style('fill', 'black')
      .style('paint-order', 'stroke')
      .style('stroke', 'white')
      .style('stroke-width', '3px')
      .style('pointer-events', 'none');

    // Render legend in a separate SVG (if showLegend is true)
    if (showLegend && fatalityExtent && fatalityExtent.length === 2 && !isNaN(fatalityExtent[0]) && !isNaN(fatalityExtent[1])) {
      const legendSvg = d3.select(legendRef.current);
      legendSvg.selectAll('*').remove();

      const legendX = (width - legendWidth) / 2;
      const legendY = 0;

      const legendScale = d3.scaleLinear()
        .domain(fatalityExtent)
        .range([0, legendWidth]);

      const defs = legendSvg.append('defs');
      const linearGradient = defs.append('linearGradient')
        .attr('id', 'legend-gradient')
        .attr('x1', '0%')
        .attr('x2', '100%')
        .attr('y1', '0%')
        .attr('y2', '0%');

      const stops = d3.range(0, 1.1, 0.1).map(t => ({
        offset: `${t * 100}%`,
        color: color(fatalityExtent[0] + t * (fatalityExtent[1] - fatalityExtent[0]))
      }));

      linearGradient.selectAll('stop')
        .data(stops)
        .enter()
        .append('stop')
        .attr('offset', d => d.offset)
        .attr('stop-color', d => d.color);

      legendSvg.append('rect')
        .attr('x', legendX)
        .attr('y', legendY)
        .attr('width', legendWidth)
        .attr('height', legendHeight)
        .attr('fill', 'url(#legend-gradient)');

      legendSvg.append('text')
        .attr('x', legendX)
        .attr('y', legendY - 5)
        .attr('text-anchor', 'start')
        .style('font-size', '12px')
        .text('Total Fatalities');

      const legendAxis = d3.axisBottom(legendScale)
        .ticks(5)
        .tickFormat(d3.format('.0f'));

      legendSvg.append('g')
        .attr('transform', `translate(${legendX}, ${legendY + legendHeight})`)
        .call(legendAxis)
        .selectAll('text')
        .style('font-size', '10px');
    }

  }, [data, width, height, showLegend, legendWidth, legendHeight]);

  return (
    <div style={{ position: 'relative' }}>
      <svg ref={legendRef} width={width} height={legendHeight + 30} style={{ display: showLegend ? 'block' : 'none', margin: '0 auto' }}></svg>
      <svg ref={svgRef} width={width} height={height}></svg>
      <div
        ref={tooltipRef}
        className="tooltip"
        style={{
          position: 'absolute',
          background: 'rgba(255, 255, 255, 0.9)',
          color: '#333',
          padding: '8px 12px',
          borderRadius: '6px',
          border: '1px solid #ccc',
          pointerEvents: 'none',
          opacity: 0,
          fontSize: '14px',
          lineHeight: '1.5',
          boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
          zIndex: 10
        }}
      ></div>
    </div>
  );
}