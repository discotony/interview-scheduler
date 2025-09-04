import React, { useState, useEffect } from 'react';
import { Calendar, Clock, Users, Filter, Upload, FileText, Grid, Table } from 'lucide-react';

const AvailabilityFilter = () => {
  const [csvData, setCsvData] = useState([]);
  const [people, setPeople] = useState([]);
  const [selectedPeople, setSelectedPeople] = useState([]);
  const [commonTimes, setCommonTimes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [fileName, setFileName] = useState('');
  const [hasData, setHasData] = useState(false);
  const [visiblePeople, setVisiblePeople] = useState([]);
  const [mergeSlots, setMergeSlots] = useState(true);
  const [showCopyMessage, setShowCopyMessage] = useState(false);

  const parseCSV = (csvText) => {
    const lines = csvText.trim().split('\n');
    const data = lines.slice(1).map(line => {
      const values = line.split(',');
      return {
        name: values[0],
        email: values[1],
        time: values[2]
      };
    });
    return data;
  };

  const copyEmailToClipboard = (email) => {
    navigator.clipboard.writeText(email);
    setShowCopyMessage(true);
    setTimeout(() => setShowCopyMessage(false), 2000);
  };

  const loadDefaultData = async () => {
    console.log('No default data in web version - please upload a CSV file');
    setLoading(false);
  };

  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (file) {
      setLoading(true);
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const csvText = e.target.result;
          const data = parseCSV(csvText);
          
          setCsvData(data);
          const uniquePeople = [...new Set(data.map(row => row.name))];
          setPeople(uniquePeople);
          setSelectedPeople([...uniquePeople]);
          setVisiblePeople([...uniquePeople]);
          setFileName(file.name);
          setHasData(true);
          setLoading(false);
        } catch (error) {
          console.error('Error parsing CSV:', error);
          alert('Error parsing CSV file. Please check the format.');
          setLoading(false);
        }
      };
      reader.readAsText(file);
    }
  };

  useEffect(() => {
    loadDefaultData();
  }, []);

  useEffect(() => {
    if (selectedPeople.length === 0) {
      setCommonTimes([]);
      return;
    }

    const selectedData = csvData.filter(row => selectedPeople.includes(row.name));
    
    const timeGroups = {};
    selectedData.forEach(row => {
      if (!timeGroups[row.time]) {
        timeGroups[row.time] = new Set();
      }
      timeGroups[row.time].add(row.name);
    });

    const common = Object.entries(timeGroups)
      .filter(([time, peopleSet]) => peopleSet.size === selectedPeople.length)
      .map(([time]) => time)
      .sort();

    setCommonTimes(common);
  }, [selectedPeople, csvData]);

  const handlePersonToggle = (person) => {
    setSelectedPeople(prev => 
      prev.includes(person) 
        ? prev.filter(p => p !== person)
        : [...prev, person]
    );
  };

  const selectAll = () => {
    setSelectedPeople(people);
  };

  const selectNone = () => {
    setSelectedPeople([]);
  };

  const formatDateTime = (timeStr) => {
    try {
      const date = new Date(timeStr);
      const startTime = date.toLocaleTimeString('en-US', { 
        hour: 'numeric', 
        minute: '2-digit'
      });
      
      const endDate = new Date(date.getTime() + 30 * 60000);
      const endTime = endDate.toLocaleTimeString('en-US', { 
        hour: 'numeric', 
        minute: '2-digit',
        timeZoneName: 'short'
      });
      
      return {
        date: date.toLocaleDateString('en-US', { 
          weekday: 'long', 
          month: 'short', 
          day: 'numeric',
          year: 'numeric'
        }),
        time: `${startTime} - ${endTime}`,
        startTime: startTime
      };
    } catch (e) {
      return { date: timeStr, time: timeStr, startTime: timeStr };
    }
  };

  const consolidateConsecutiveTimes = (times) => {
    if (times.length === 0) return [];
    
    const sortedTimes = times.sort((a, b) => new Date(a) - new Date(b));
    const consolidated = [];
    let currentBlock = {
      start: sortedTimes[0],
      end: new Date(new Date(sortedTimes[0]).getTime() + 30 * 60000),
      slots: 1
    };
    
    for (let i = 1; i < sortedTimes.length; i++) {
      const currentTime = new Date(sortedTimes[i]);
      
      if (currentTime.getTime() === currentBlock.end.getTime()) {
        currentBlock.end = new Date(currentTime.getTime() + 30 * 60000);
        currentBlock.slots++;
      } else {
        consolidated.push(currentBlock);
        currentBlock = {
          start: sortedTimes[i],
          end: new Date(new Date(sortedTimes[i]).getTime() + 30 * 60000),
          slots: 1
        };
      }
    }
    
    consolidated.push(currentBlock);
    return consolidated;
  };

  const formatTimeBlock = (block) => {
    const startTime = new Date(block.start).toLocaleTimeString('en-US', { 
      hour: 'numeric', 
      minute: '2-digit'
    });
    const endTime = block.end.toLocaleTimeString('en-US', { 
      hour: 'numeric', 
      minute: '2-digit',
      timeZoneName: 'short'
    });
    
    const duration = block.slots * 30;
    const durationText = duration >= 60 
      ? `${Math.floor(duration / 60)}h ${duration % 60 > 0 ? `${duration % 60}m` : ''}`.trim()
      : `${duration}m`;
    
    return {
      timeRange: `${startTime} - ${endTime}`,
      duration: durationText,
      slots: block.slots
    };
  };

  const groupByDate = (times) => {
    const groups = {};
    times.forEach(time => {
      const { date } = formatDateTime(time);
      if (!groups[date]) {
        groups[date] = [];
      }
      groups[date].push(time);
    });
    
    Object.keys(groups).forEach(date => {
      if (mergeSlots) {
        groups[date] = consolidateConsecutiveTimes(groups[date]);
      } else {
        groups[date] = groups[date].map(time => ({
          start: time,
          end: new Date(new Date(time).getTime() + 30 * 60000),
          slots: 1
        }));
      }
    });
    
    return groups;
  };

  const getOverlapCalendarData = () => {
    if (!csvData.length) return { dates: [], timeSlots: [], overlapData: {} };
    
    const allDates = [...new Set(csvData.map(row => {
      const date = new Date(row.time);
      return date.toDateString();
    }))].sort((a, b) => new Date(a) - new Date(b));
    
    const allTimes = [...new Set(csvData.map(row => {
      const date = new Date(row.time);
      return date.toLocaleTimeString('en-US', { 
        hour: 'numeric', 
        minute: '2-digit'
      });
    }))].sort((a, b) => {
      const timeA = new Date(`1970/01/01 ${a}`);
      const timeB = new Date(`1970/01/01 ${b}`);
      return timeA - timeB;
    });
    
    const overlapMatrix = {};
    allDates.forEach(date => {
      overlapMatrix[date] = {};
      allTimes.forEach(time => {
        overlapMatrix[date][time] = {
          count: 0,
          people: [],
          total: people.length
        };
      });
    });
    
    csvData.forEach(row => {
      const date = new Date(row.time).toDateString();
      const time = new Date(row.time).toLocaleTimeString('en-US', { 
        hour: 'numeric', 
        minute: '2-digit'
      });
      if (overlapMatrix[date] && overlapMatrix[date][time]) {
        overlapMatrix[date][time].count++;
        overlapMatrix[date][time].people.push(row.name);
      }
    });
    
    return {
      dates: allDates,
      timeSlots: allTimes,
      overlapData: overlapMatrix
    };
  };

  const getPersonColor = (personIndex, total) => {
    const colors = [
      'bg-red-100 text-red-800 border-red-300',
      'bg-orange-100 text-orange-800 border-orange-300',
      'bg-yellow-100 text-yellow-800 border-yellow-300',
      'bg-green-100 text-green-800 border-green-300',
      'bg-blue-100 text-blue-800 border-blue-300',
      'bg-indigo-100 text-indigo-800 border-indigo-300',
      'bg-purple-100 text-purple-800 border-purple-300',
      'bg-pink-100 text-pink-800 border-pink-300'
    ];
    return colors[personIndex % colors.length];
  };

  const getPersonInitials = (name) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const formatCalendarDate = (dateStr) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { 
      weekday: 'short', 
      month: 'short', 
      day: 'numeric'
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-lg">Loading availability data...</div>
      </div>
    );
  }

  const { dates, timeSlots, overlapData } = getOverlapCalendarData();
  const groupedTimes = groupByDate(commonTimes);

  return (
    <div className="max-w-6xl mx-auto p-6 bg-white">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2 flex items-center gap-2">
          <Calendar className="text-blue-600" />
          Interview Availability Filter
        </h1>
        <p className="text-gray-600 text-left">Upload a CSV file downloaded from <a href="https://zcal.co/" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-800 underline">https://zcal.co/</a> poll results</p>
      </div>

      <div className="mb-6 p-4 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
        <div className="mb-4">
          <h2 className="text-lg font-semibold flex items-center gap-2 mb-3">
            <FileText className="text-gray-600" />
            Import CSV File
          </h2>
          {fileName && (
            <div className="text-sm text-gray-600 bg-white px-3 py-1 rounded text-left">
              Uploaded File Name: <span className="font-medium">{fileName}</span>
            </div>
          )}
        </div>
        
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg cursor-pointer hover:bg-blue-700 transition-colors">
            <Upload size={16} />
            Upload CSV File
            <input
              type="file"
              accept=".csv"
              onChange={handleFileUpload}
              className="hidden"
            />
          </label>
          
          <button
            onClick={() => {
              setCsvData([]);
              setPeople([]);
              setSelectedPeople([]);
              setVisiblePeople([]);
              setCommonTimes([]);
              setFileName('');
              setHasData(false);
            }}
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
            disabled={!hasData}
          >
            Clear File
          </button>
        </div>
      </div>

      {!hasData ? (
        <div className="text-center py-12 text-gray-500">
          <FileText className="mx-auto mb-4 text-gray-400" size={64} />
          <p className="text-lg">No data loaded</p>
          <p className="text-sm">Upload a CSV file to get started</p>
        </div>
      ) : (
        <>
          <div className="mb-8 p-4 bg-purple-50 rounded-lg border border-purple-200">
            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
              <Grid className="text-purple-600" />
              Calendar View
            </h2>
            
            <div className="overflow-x-auto">
              <div className="min-w-max">
                <div className="grid gap-2" style={{ gridTemplateColumns: `120px repeat(${dates.length}, 140px)` }}>
                  <div className="p-3 font-semibold text-gray-700 bg-gray-100 rounded text-sm text-center">
                    Time Slots
                  </div>
                  {dates.map(date => (
                    <div key={date} className="p-3 font-semibold text-gray-700 bg-gray-100 rounded text-sm text-center">
                      {formatCalendarDate(date)}
                    </div>
                  ))}
                  
                  {timeSlots.map(time => {
                    try {
                      const timeDate = new Date(`1970/01/01 ${time}`);
                      const startTime = timeDate.toLocaleTimeString('en-US', { 
                        hour: 'numeric', 
                        minute: '2-digit'
                      });
                      const endDate = new Date(timeDate.getTime() + 30 * 60000);
                      const endTime = endDate.toLocaleTimeString('en-US', { 
                        hour: 'numeric', 
                        minute: '2-digit'
                      });
                      
                      return (
                        <React.Fragment key={time}>
                          <div className="p-2 font-medium text-gray-800 bg-gray-50 rounded text-xs flex items-center justify-center">
                            <div className="text-center">
                              <div>{startTime}</div>
                              <div className="text-gray-400">—</div>
                              <div>{endTime}</div>
                            </div>
                          </div>
                          
                          {dates.map(date => {
                            const slotData = overlapData[date]?.[time] || { count: 0, people: [], total: people.length };
                            const visiblePeopleInSlot = slotData.people.filter(person => visiblePeople.includes(person));
                            
                            return (
                              <div 
                                key={`${time}-${date}`} 
                                className="p-2 bg-white rounded border border-gray-200 min-h-[80px]"
                              >
                                {visiblePeopleInSlot.length > 0 ? (
                                  <div className="flex flex-wrap gap-1">
                                    {visiblePeopleInSlot.map((person) => {
                                      const personIndex = people.indexOf(person);
                                      const colorClass = getPersonColor(personIndex, people.length);
                                      const initials = getPersonInitials(person);
                                      
                                      return (
                                        <div
                                          key={person}
                                          className={`px-2 py-1 rounded text-xs font-medium border ${colorClass}`}
                                          title={person}
                                        >
                                          {initials}
                                        </div>
                                      );
                                    })}
                                  </div>
                                ) : (
                                  <div className="text-center text-gray-400 text-xs py-2">
                                    —
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </React.Fragment>
                      );
                    } catch (e) {
                      return (
                        <React.Fragment key={time}>
                          <div className="p-3 font-medium text-gray-800 bg-gray-50 rounded text-sm flex items-center justify-center">
                            {time}
                          </div>
                          
                          {dates.map(date => {
                            const slotData = overlapData[date]?.[time] || { count: 0, people: [], total: people.length };
                            const visiblePeopleInSlot = slotData.people.filter(person => visiblePeople.includes(person));
                            
                            return (
                              <div 
                                key={`${time}-${date}`} 
                                className="p-2 bg-white rounded border border-gray-200 min-h-[80px]"
                              >
                                {visiblePeopleInSlot.length > 0 ? (
                                  <div className="flex flex-wrap gap-1">
                                    {visiblePeopleInSlot.map((person) => {
                                      const personIndex = people.indexOf(person);
                                      const colorClass = getPersonColor(personIndex, people.length);
                                      const initials = getPersonInitials(person);
                                      
                                      return (
                                        <div
                                          key={person}
                                          className={`px-2 py-1 rounded text-xs font-medium border ${colorClass}`}
                                          title={person}
                                        >
                                          {initials}
                                        </div>
                                      );
                                    })}
                                  </div>
                                ) : (
                                  <div className="text-center text-gray-400 text-xs py-2">
                                    —
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </React.Fragment>
                      );
                    }
                  })}
                </div>
              </div>
            </div>
            
            <div className="mt-6 space-y-3">
              <div className="flex items-center gap-4">
                <div className="text-sm font-semibold text-gray-700">Select Participants:</div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setVisiblePeople([...people])}
                    className={`px-3 py-1 text-sm rounded transition-colors ${
                      visiblePeople.length === people.length 
                        ? 'bg-blue-500 text-white' 
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    All
                  </button>
                  <button
                    onClick={() => setVisiblePeople([])}
                    className={`px-3 py-1 text-sm rounded transition-colors ${
                      visiblePeople.length === 0 
                        ? 'bg-blue-500 text-white' 
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    None
                  </button>
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {people.map((person, index) => {
                  const colorClass = getPersonColor(index, people.length);
                  const initials = getPersonInitials(person);
                  const isVisible = visiblePeople.includes(person);
                  const personData = csvData.find(row => row.name === person);
                  return (
                    <label key={person} className="flex items-center gap-3 cursor-pointer p-2 rounded">
                      <input
                        type="checkbox"
                        checked={isVisible}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setVisiblePeople(prev => [...prev, person]);
                          } else {
                            setVisiblePeople(prev => prev.filter(p => p !== person));
                          }
                        }}
                        className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                      />
                      <div className={`px-2 py-1 rounded text-xs font-medium border ${colorClass} ${!isVisible ? 'opacity-50' : ''}`}>
                        {initials}
                      </div>
                      <div className={`text-gray-700 ${!isVisible ? 'opacity-50' : ''}`}>
                        <span className="font-medium text-sm">{person}</span>
                        {personData?.email && (
                          <span 
                            className="text-xs text-gray-500 ml-2 cursor-pointer hover:text-blue-600"
                            onClick={(e) => {
                              e.preventDefault();
                              copyEmailToClipboard(personData.email);
                            }}
                            title="Click to copy email"
                          >
                            ({personData.email})
                          </span>
                        )}
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="my-8 border-t border-gray-200"></div>

          <h2 className="text-xl font-semibold mb-6 flex items-center gap-2">
            <Table className="text-purple-600" />
            Table View
          </h2>
          
          <div className="space-y-6">
            <div className="bg-white rounded-lg p-4 border border-gray-200">
              <div className="flex items-center gap-4 mb-4">
                <h3 className="text-xl font-semibold flex items-center gap-2 text-left">
                  <Users className="text-green-600" />
                  Select Participants
                </h3>
                <div className="flex gap-2">
                  <button
                    onClick={selectAll}
                    className={`px-3 py-1 text-sm rounded transition-colors ${
                      selectedPeople.length === people.length 
                        ? 'bg-blue-500 text-white' 
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    All
                  </button>
                  <button
                    onClick={selectNone}
                    className={`px-3 py-1 text-sm rounded transition-colors ${
                      selectedPeople.length === 0 
                        ? 'bg-blue-500 text-white' 
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    None
                  </button>
                </div>
              </div>
              
              <div className="space-y-2">
                {people.map(person => {
                  const personData = csvData.find(row => row.name === person);
                  return (
                    <label key={person} className="flex items-center space-x-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedPeople.includes(person)}
                        onChange={() => handlePersonToggle(person)}
                        className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                      />
                      <div className="text-gray-700 text-left">
                        <span className="font-medium">{person}</span>
                        {personData?.email && (
                          <span 
                            className="text-sm text-gray-500 ml-2 cursor-pointer hover:text-blue-600"
                            onClick={(e) => {
                              e.preventDefault();
                              copyEmailToClipboard(personData.email);
                            }}
                            title="Click to copy email"
                          >
                            ({personData.email})
                          </span>
                        )}
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>

            <div className="bg-white rounded-lg p-4 border border-gray-200">
              <div className="flex items-center gap-4 mb-4">
                <h3 className="text-xl font-semibold flex items-center gap-2 text-left">
                  <Filter className="text-blue-600" />
                  Common Available Times
                </h3>
                
                <div className="flex items-center gap-2">
                  <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={mergeSlots}
                      onChange={(e) => setMergeSlots(e.target.checked)}
                      className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                    />
                    <span className="whitespace-nowrap">Combine Slots</span>
                  </label>
                </div>
              </div>

              {selectedPeople.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <Clock className="mx-auto mb-2 text-gray-400" size={48} />
                  <p>Select at least one participant to see available times</p>
                </div>
              ) : commonTimes.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <Clock className="mx-auto mb-2 text-gray-400" size={48} />
                  <p>No common available times found for selected participants</p>
                  <p className="text-sm mt-1">Try selecting fewer people or check individual availability</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {Object.entries(groupedTimes).map(([date, times]) => (
                    <div key={date} className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                      <h3 className="font-semibold text-gray-800 mb-3 border-b pb-2 text-left">
                        {date}
                      </h3>
                      <div className="grid grid-cols-1 gap-2">
                        {times.map((block, index) => {
                          const { timeRange, duration } = formatTimeBlock(block);
                          return (
                            <div
                              key={index}
                              className="px-3 py-3 bg-green-100 text-green-800 rounded text-sm hover:bg-green-200 cursor-pointer transition-colors text-left"
                            >
                              <div className="font-medium">{timeRange}</div>
                              <div className="text-xs text-green-600 mt-1">
                                Duration: {duration}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {selectedPeople.length > 0 && (
              <div className="bg-white rounded-lg p-4 border border-gray-200">
                <h3 className="text-xl font-semibold flex items-center gap-2 mb-2 text-left">
                  <Clock className="text-gray-600" />
                  Summary
                </h3>
                <div className="text-sm text-gray-600 space-y-2 text-left">
                  <div>
                    Finding availability for: <strong>{selectedPeople.join(', ')}</strong>
                  </div>
                  {commonTimes.length > 0 && (
                    <div className="mt-2 space-y-2">
                      {Object.entries(groupedTimes).map(([date, blocks]) => (
                        <div key={date}>
                          <div className="font-medium text-gray-700 mb-1">{date}:</div>
                          <div className="flex flex-wrap gap-2 ml-4">
                            {blocks.map((block, index) => {
                              const { timeRange, duration } = formatTimeBlock(block);
                              return (
                                <span key={index} className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded">
                                  {timeRange} ({duration})
                                </span>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </>
      )}
      
      {showCopyMessage && (
        <div className="fixed top-4 right-4 bg-green-500 text-white px-4 py-2 rounded-lg shadow-lg z-50">
          Email copied to clipboard!
        </div>
      )}
    </div>
  );
};

export default AvailabilityFilter;