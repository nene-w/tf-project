#!/usr/bin/env node

/**
 * 测试 FLAME 数据刷新功能
 */

import { fetchFLAMEData } from './fetch_flame_data_wrapper.ts';

async function test() {
  console.log('Testing FLAME data refresh...');
  
  try {
    const data = await fetchFLAMEData();
    console.log(`✓ Successfully fetched ${data.length} FLAME data items`);
    
    if (data.length > 0) {
      console.log('\nSample data:');
      console.log(JSON.stringify(data.slice(0, 3), null, 2));
    }
  } catch (error) {
    console.error('✗ Error fetching FLAME data:', error);
    process.exit(1);
  }
}

test();
