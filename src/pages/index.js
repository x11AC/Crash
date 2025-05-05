import { useState } from 'react';
import Papa from 'papaparse';
import _ from 'lodash';
import { StackedAreaChart } from '../components/StackedAreaChart';
import { Treemap } from '../components/Treemap';
import styles from '../styles/Home.module.css';

export async function getStaticProps() {
  const response = await fetch('https://gist.githubusercontent.com/x11AC/c0b15e695934ebb367b3b19aa93d0dc6/raw/13d21609f09dbf76235ee5ee43d15d55dfb6e450/Plane%2520Crash_updated.csv');
  const csvData = await response.text();

  const { data } = Papa.parse(csvData, { header: true });

  const cleanedData = data
    .filter(row => 
      row.Date && 
      row['Crash cause'] && 
      row['Crash site'] && 
      row['Total fatalities'] !== null && 
      row['Total fatalities'] !== undefined && 
      row['Survivors'] !== null && 
      row['Survivors'] !== undefined
    )
    .map(row => {
      const year = parseInt(new Date(row.Date).getFullYear(), 10);
      if (isNaN(year)) {
        console.warn('Invalid year for row:', row);
        return null;
      }
      let cause = row['Crash cause'];
      if (cause === 'Terrorism act, Hijacking, Sabotage' || cause === 'Hijacking') {
        cause = 'Terrorism';
      }
      return {
        year,
        cause,
        location: row['Crash site'],
        fatalities: parseInt(row['Total fatalities'], 10),
        survivors: row.Survivors === 'Yes' ? 'Yes' : 'No'
      };
    })
    .filter(row => row !== null && row.cause !== 'Unknown');

  const causes = _.uniq(cleanedData.map(row => row.cause)).filter(cause => cause !== undefined && cause !== null);

  console.log('Causes:', causes);

  const stackedAreaData = _.chain(cleanedData)
    .groupBy('year')
    .map((yearGroup, year) => {
      const causeCounts = _.fromPairs(causes.map(cause => [cause, 0]));
      const groupByCause = _.groupBy(yearGroup, 'cause');
      _.forEach(groupByCause, (group, cause) => {
        causeCounts[cause] = group.length;
      });
      return { year: parseInt(year, 10), ...causeCounts };
    })
    .value();

  const treemapDefaultData = _.chain(cleanedData)
    .groupBy('cause')
    .map((causeGroup, cause) => {
      const survivorsGroup = _.groupBy(causeGroup, 'survivors');
      return {
        name: cause,
        children: _.map(survivorsGroup, (group, survivors) => ({
          name: survivors,
          crashes: group.length,
          fatalities: _.sumBy(group, 'fatalities')
        }))
      };
    })
    .value();

  const treemapInteractiveData = _.chain(cleanedData)
    .groupBy('cause')
    .map((causeGroup, cause) => {
      const locationGroup = _.groupBy(causeGroup, 'location');
      return {
        cause,
        locations: _.map(locationGroup, (locGroup, location) => {
          const survivorsGroup = _.groupBy(locGroup, 'survivors');
          return {
            name: location,
            children: _.map(survivorsGroup, (group, survivors) => ({
              name: survivors,
              crashes: group.length,
              fatalities: _.sumBy(group, 'fatalities')
            }))
          };
        })
      };
    })
    .keyBy('cause')
    .value();

  console.log('treemapInteractiveData keys:', Object.keys(treemapInteractiveData));

  return {
    props: {
      stackedAreaData,
      treemapDefaultData,
      treemapInteractiveData,
      causes
    }
  };
}

export default function Home({ stackedAreaData, treemapDefaultData, treemapInteractiveData, causes }) {
  const [selectedCause, setSelectedCause] = useState(null);

  console.log('Selected Cause:', selectedCause);
  console.log('treemapInteractiveData[selectedCause]:', selectedCause ? treemapInteractiveData[selectedCause] : 'Not selected');

  const treemapData = {
    title: selectedCause ? `Crash Locations for Cause: ${selectedCause}` : 'Crashes by Cause',
    data: selectedCause && treemapInteractiveData[selectedCause]
      ? { name: 'Root', children: treemapInteractiveData[selectedCause].locations || [] }
      : { name: 'Root', children: treemapDefaultData }
  };

  const handleReset = () => {
    setSelectedCause(null);
  };

  return (
    <div className={styles.container}>
      <h1 className={styles.title}>Historical Airplane Crashes Visualization</h1>
      <div className={styles.instructions}>
        <h3>Instructions:</h3>
        <p>
          - The <strong>Stacked Area Chart</strong> shows the number of crashes per year, grouped by cause.<br />
          - Hover over <strong>the BLANK area</strong> between decade lines (e.g., 2010-2020) to see the total crashes for each cause in that decade.<br />
          - Click on a cause in the stacked area chart to view a treemap of crash locations for that cause.<br />
        </p>
      </div>
      <div className={styles.chartContainer}>
        <h2>Stacked Area Chart: Crashes Over Time by Cause</h2>
        <StackedAreaChart
          data={stackedAreaData}
          causes={causes}
          setSelectedCause={setSelectedCause}
          width={1000}
          height={400}
        />
      </div>
      <div className={styles.instructions}>
        <h3>Instructions:</h3>
        <p>
        - The <strong>Treemap</strong> initially shows crashes by cause, split by survivors. After clicking a cause, it shows crash locations for that cause.<br />
        - Each treemap node represents a location, with the size indicating the number of crashes and color indicating fatalities.<br />
        - Hover over treemap nodes to see detailed information (crashes and fatalities).<br />
        - Click the "Reset Treemap" button or select a different cause to change the treemap view.
        </p>
      </div>
      <div className={styles.chartContainer}>
        <h2>{treemapData.title}</h2>
        {selectedCause && !treemapInteractiveData[selectedCause] ? (
          <p>No location data available for cause: {selectedCause}</p>
        ) : (
          <Treemap
            data={treemapData.data}
            width={1000} // Increased from 800
            height={800} // Increased from 600
            showLegend={true}
            legendWidth={200}
            legendHeight={20}
          />
        )}
        {selectedCause && (
          <button className={styles.resetButton} onClick={handleReset}>
            Reset Treemap
          </button>
        )}
      </div>
    </div>
  );
}