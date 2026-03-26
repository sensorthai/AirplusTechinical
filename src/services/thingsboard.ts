import axios from 'axios';

const BASE_URL = 'https://smarthome.lh.co.th';

export interface AuthResponse {
  token: string;
  refreshToken: string;
}

export interface AssetInfo {
  id: { id: string; entityType: string };
  name: string;
  label: string;
  type: string;
  address?: string;
  orderId?: string;
  transferDate?: string;
  project?: string;
  activeTask?: boolean;
  techTask?: string;
  taskTimestamp?: number;
}

export interface Relation {
  from: { id: string; entityType: string };
  to: { id: string; entityType: string };
  type: string;
}

export interface TelemetryValue {
  ts: number;
  value: string;
}

export interface TelemetryResponse {
  [key: string]: TelemetryValue[];
}

class ThingsboardService {
  private token: string | null = null;

  setToken(token: string) {
    this.token = token;
  }

  private get headers() {
    return {
      'X-Authorization': `Bearer ${this.token}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };
  }

  async login(username: string, password: string): Promise<AuthResponse> {
    console.log('Attempting login for:', username);
    try {
      const response = await axios.post(`${BASE_URL}/api/auth/login`, {
        username,
        password,
      });
      this.token = response.data.token;
      console.log('Login successful');
      return response.data;
    } catch (error: any) {
      console.error('Login error details:', error.response?.data || error.message);
      throw error;
    }
  }

  async searchAssets(textSearch: string): Promise<AssetInfo[]> {
    console.log('Searching assets with text:', textSearch);
    try {
      const response = await axios.get(`${BASE_URL}/api/tenant/assets`, {
        params: {
          pageSize: 50,
          page: 0,
          textSearch,
        },
        headers: this.headers,
      });
      return response.data.data || [];
    } catch (error: any) {
      console.error('Asset search error:', error.response?.data || error.message);
      throw error;
    }
  }

  async getAssetById(assetId: string): Promise<AssetInfo> {
    console.log('Fetching asset by id:', assetId);
    try {
      const response = await axios.get(`${BASE_URL}/api/asset/${assetId}`, {
        headers: this.headers,
      });
      return response.data;
    } catch (error: any) {
      console.error('Asset fetch by id error:', error.response?.data || error.message);
      throw error;
    }
  }
  async getAssetsByProfile(profileName: string = 'House'): Promise<AssetInfo[]> {
    console.log('Fetching assets for profile:', profileName);
    try {
      // Try fetching by type first, as "House" is often the asset type
      const response = await axios.get(`${BASE_URL}/api/tenant/assets`, {
        params: {
          pageSize: 16000,
          page: 0,
          type: profileName,
        },
        headers: this.headers,
      });
      console.log('Assets fetched successfully:', response.data.data?.length);
      return response.data.data;
    } catch (error: any) {
      console.warn('Failed to fetch assets by type, trying generic fetch...', error.response?.data || error.message);
      
      // Fallback: fetch all assets and filter manually if needed
      try {
        const response = await axios.get(`${BASE_URL}/api/tenant/assets`, {
          params: {
            pageSize: 16000,
            page: 0,
          },
          headers: this.headers,
        });
        const allAssets = response.data.data || [];
        return allAssets.filter((a: any) => a.type === profileName || a.assetProfileName === profileName);
      } catch (innerError: any) {
        console.error('Asset fetch error:', innerError.response?.data || innerError.message);
        throw innerError;
      }
    }
  }

  async searchDevices(textSearch: string): Promise<any[]> {
    console.log('Searching devices with text:', textSearch);
    try {
      const response = await axios.get(`${BASE_URL}/api/tenant/devices`, {
        params: {
          pageSize: 50,
          page: 0,
          textSearch,
        },
        headers: this.headers,
      });
      return response.data.data || [];
    } catch (error: any) {
      console.error('Device search error:', error.response?.data || error.message);
      throw error;
    }
  }
  async getTenantDevices(pageSize: number = 100): Promise<any[]> {
    console.log('Fetching tenant devices...');
    try {
      const response = await axios.get(`${BASE_URL}/api/tenant/devices`, {
        params: {
          pageSize,
          page: 0,
        },
        headers: this.headers,
      });
      return response.data.data;
    } catch (error: any) {
      console.error('Device fetch error:', error.response?.data || error.message);
      throw error;
    }
  }

  async getDeviceRelations(deviceId: string): Promise<Relation[]> {
    console.log('Fetching relations for device:', deviceId);
    try {
      const response = await axios.get(`${BASE_URL}/api/relations`, {
        params: {
          toId: deviceId,
          toType: 'DEVICE',
          relationTypeGroup: 'COMMON'
        },
        headers: this.headers,
      });
      return response.data;
    } catch (error: any) {
      console.error('Device relations fetch error:', error.response?.data || error.message);
      throw error;
    }
  }

  async getAssetRelations(assetId: string): Promise<Relation[]> {
    console.log('Fetching relations for asset:', assetId);
    try {
      const response = await axios.get(`${BASE_URL}/api/relations`, {
        params: {
          fromId: assetId,
          fromType: 'ASSET',
          relationTypeGroup: 'COMMON'
        },
        headers: this.headers,
      });
      return response.data;
    } catch (error: any) {
      console.error('Relations fetch error:', error.response?.data || error.message);
      throw error;
    }
  }

  async getAllAttributes(entityType: string, entityId: string): Promise<any[]> {
    console.log(`Fetching all attributes for ${entityType}:`, entityId);
    try {
      const response = await axios.get(`${BASE_URL}/api/plugins/telemetry/${entityType}/${entityId}/values/attributes`, {
        headers: this.headers,
      });
      return response.data || [];
    } catch (error: any) {
      console.error('All attributes fetch error:', error.response?.data || error.message);
      return [];
    }
  }

  async getAttributes(entityType: string, entityId: string, scope: string, keys?: string[]): Promise<any> {
    console.log(`Fetching ${scope} attributes for ${entityType}:`, entityId);
    try {
      const response = await axios.get(`${BASE_URL}/api/plugins/telemetry/${entityType}/${entityId}/values/attributes/${scope}`, {
        params: keys ? { keys: keys.join(',') } : {},
        headers: this.headers,
      });
      return response.data;
    } catch (error: any) {
      console.error('Attributes fetch error:', error.response?.data || error.message);
      throw error;
    }
  }

  async searchAssetsInGroup(groupName: string, textSearch: string): Promise<AssetInfo[]> {
    console.log(`Searching assets in group "${groupName}" with text:`, textSearch);
    try {
      // 1. Find the group ID by name
      let targetGroup = null;
      try {
        const groupsResponse = await axios.get(`${BASE_URL}/api/entityGroups/ASSET`, {
          params: { pageSize: 100, page: 0 },
          headers: this.headers,
        });
        
        const groups = groupsResponse.data.data || [];
        targetGroup = groups.find((g: any) => g.name === groupName);
      } catch (e: any) {
        console.warn('Failed to fetch asset groups, falling back to global search', e.message);
        return this.searchAssets(textSearch);
      }
      
      if (!targetGroup) {
        console.warn(`Group "${groupName}" not found, falling back to global search`);
        return this.searchAssets(textSearch);
      }
      
      // 2. Search assets in that group
      try {
        const assetsResponse = await axios.get(`${BASE_URL}/api/entityGroup/${targetGroup.id.id}/entities`, {
          params: { 
            pageSize: 50, 
            page: 0,
            textSearch
          },
          headers: this.headers,
        });
        
        return assetsResponse.data.data || [];
      } catch (e: any) {
        console.warn('Failed to search entities in group, falling back to global search', e.message);
        return this.searchAssets(textSearch);
      }
    } catch (error: any) {
      console.error('Group search error:', error.response?.data || error.message);
      return this.searchAssets(textSearch);
    }
  }

  async getAssetsWithActiveTasks(groupName: string = 'Houses'): Promise<AssetInfo[]> {
    console.log(`Querying assets with ActiveTask=true in group "${groupName}"...`);
    try {
      // 1. Find the group ID by name
      const groupsResponse = await axios.get(`${BASE_URL}/api/entityGroups/ASSET`, {
        params: { pageSize: 100, page: 0 },
        headers: this.headers,
      });
      const groups = groupsResponse.data.data || [];
      const targetGroup = groups.find((g: any) => g.name === groupName);
      
      if (!targetGroup) {
        console.warn(`Group "${groupName}" not found for active task query`);
        return [];
      }

      // 2. Perform entity query to get only assets with ActiveTask=true
      const query = {
        entityFilter: {
          type: 'entityGroup',
          groupType: 'ASSET',
          entityGroupId: targetGroup.id.id
        },
        keyFilters: [
          {
            key: { type: 'TIME_SERIES', key: 'ActiveTask' },
            valueType: 'BOOLEAN',
            predicate: {
              type: 'BOOLEAN',
              operation: 'EQUAL',
              value: { defaultValue: true }
            }
          }
        ],
        entityFields: [
          { type: 'ENTITY_FIELD', key: 'name' },
          { type: 'ENTITY_FIELD', key: 'label' },
          { type: 'ENTITY_FIELD', key: 'type' }
        ],
        latestValues: [
          { type: 'TIME_SERIES', key: 'ActiveTask' },
          { type: 'TIME_SERIES', key: 'TechTask' },
          { type: 'ATTRIBUTE', key: 'ActiveTask' },
          { type: 'ATTRIBUTE', key: 'TechTask' },
          { type: 'ATTRIBUTE', key: 'address' },
          { type: 'ATTRIBUTE', key: 'Address' },
          { type: 'ATTRIBUTE', key: 'addr' },
          { type: 'ATTRIBUTE', key: 'Addr' },
          { type: 'ATTRIBUTE', key: 'Address1' },
          { type: 'ATTRIBUTE', key: 'houseNo' },
          { type: 'ATTRIBUTE', key: 'HouseNo' },
          { type: 'ATTRIBUTE', key: 'project' },
          { type: 'ATTRIBUTE', key: 'รหัสใบสั่งซื้อ' },
          { type: 'ATTRIBUTE', key: 'วันที่โอน' },
          { type: 'ATTRIBUTE', key: 'รหัสแปลง' },
          { type: 'ATTRIBUTE', key: 'เลขที่บ้าน' }
        ],
        pageLink: {
          pageSize: 16000,
          page: 0,
          sortOrder: {
            key: { type: 'ENTITY_FIELD', key: 'name' },
            direction: 'ASC'
          }
        }
      };

      const response = await axios.post(`${BASE_URL}/api/queries/entities`, query, {
        headers: this.headers,
      });

      const data = response.data.data || [];
      return data.map((item: any) => {
        const latest = item.latest || {};
        // Check both TIME_SERIES and ATTRIBUTE for ActiveTask and TechTask
        const activeTaskVal = latest.ATTRIBUTE?.ActiveTask?.value || latest.TIME_SERIES?.ActiveTask?.value;
        const techTaskVal = latest.ATTRIBUTE?.TechTask?.value || latest.TIME_SERIES?.TechTask?.value;
        const taskTs = latest.ATTRIBUTE?.ActiveTask?.ts || latest.TIME_SERIES?.ActiveTask?.ts || 
                       latest.ATTRIBUTE?.TechTask?.ts || latest.TIME_SERIES?.TechTask?.ts;
        
        const addressVal = 
          latest.ATTRIBUTE?.address?.value || 
          latest.ATTRIBUTE?.Address?.value || 
          latest.ATTRIBUTE?.addr?.value || 
          latest.ATTRIBUTE?.Addr?.value || 
          latest.ATTRIBUTE?.Address1?.value || 
          latest.ATTRIBUTE?.houseNo?.value || 
          latest.ATTRIBUTE?.HouseNo?.value || 
          latest.ATTRIBUTE?.['เลขที่บ้าน']?.value;
        const projectVal = latest.ATTRIBUTE?.project?.value;
        const orderIdVal = latest.ATTRIBUTE?.['รหัสใบสั่งซื้อ']?.value || latest.ATTRIBUTE?.['รหัสแปลง']?.value;
        const transferDateVal = latest.ATTRIBUTE?.['วันที่โอน']?.value;

        return {
          id: item.id,
          name: item.name,
          label: item.label,
          type: item.type,
          address: addressVal,
          project: projectVal,
          orderId: orderIdVal,
          transferDate: transferDateVal,
          activeTask: activeTaskVal === 'true' || activeTaskVal === true || activeTaskVal === '1',
          techTask: techTaskVal,
          taskTimestamp: taskTs
        };
      });
    } catch (error: any) {
      console.error('Entity query error:', error.response?.data || error.message);
      return [];
    }
  }

  async searchAssetsByAddress(searchTerm: string, groupName: string = 'Houses'): Promise<AssetInfo[]> {
    console.log(`Searching assets by address "${searchTerm}" in group "${groupName}" at server...`);
    try {
      // 1. Find the group ID by name
      const groupsResponse = await axios.get(`${BASE_URL}/api/entityGroups/ASSET`, {
        params: { pageSize: 100, page: 0 },
        headers: this.headers,
      });
      const groups = groupsResponse.data.data || [];
      const targetGroup = groups.find((g: any) => g.name === groupName);
      
      if (!targetGroup) {
        console.warn(`Group "${groupName}" not found for search`);
        return [];
      }

      // 2. Perform entity query with keyFilter on address
      const query = {
        entityFilter: {
          type: 'entityGroup',
          groupType: 'ASSET',
          entityGroupId: targetGroup.id.id
        },
        keyFilters: [
          {
            key: { type: 'ATTRIBUTE', key: 'address' },
            valueType: 'STRING',
            predicate: {
              type: 'STRING',
              operation: 'CONTAINS',
              value: { defaultValue: searchTerm, dynamicValue: null },
              ignoreCase: true
            }
          }
        ],
        entityFields: [
          { type: 'ENTITY_FIELD', key: 'name' },
          { type: 'ENTITY_FIELD', key: 'label' },
          { type: 'ENTITY_FIELD', key: 'type' }
        ],
        latestValues: [
          { type: 'TIME_SERIES', key: 'ActiveTask' },
          { type: 'TIME_SERIES', key: 'TechTask' },
          { type: 'ATTRIBUTE', key: 'address' },
          { type: 'ATTRIBUTE', key: 'Address' },
          { type: 'ATTRIBUTE', key: 'addr' },
          { type: 'ATTRIBUTE', key: 'Addr' },
          { type: 'ATTRIBUTE', key: 'Address1' },
          { type: 'ATTRIBUTE', key: 'houseNo' },
          { type: 'ATTRIBUTE', key: 'HouseNo' },
          { type: 'ATTRIBUTE', key: 'project' },
          { type: 'ATTRIBUTE', key: 'รหัสใบสั่งซื้อ' },
          { type: 'ATTRIBUTE', key: 'วันที่โอน' },
          { type: 'ATTRIBUTE', key: 'รหัสแปลง' },
          { type: 'ATTRIBUTE', key: 'เลขที่บ้าน' }
        ],
        pageLink: {
          pageSize: 100,
          page: 0,
          sortOrder: {
            key: { type: 'ENTITY_FIELD', key: 'name' },
            direction: 'ASC'
          }
        }
      };

      const response = await axios.post(`${BASE_URL}/api/queries/entities`, query, {
        headers: this.headers,
      });

      const data = response.data.data || [];
      return data.map((item: any) => {
        const latest = item.latest || {};
        const activeTaskVal = latest.TIME_SERIES?.ActiveTask?.value;
        const techTaskVal = latest.TIME_SERIES?.TechTask?.value;
        const taskTs = latest.TIME_SERIES?.ActiveTask?.ts || latest.TIME_SERIES?.TechTask?.ts;
        
        const addressVal = 
          latest.ATTRIBUTE?.address?.value || 
          latest.ATTRIBUTE?.Address?.value || 
          latest.ATTRIBUTE?.addr?.value || 
          latest.ATTRIBUTE?.Addr?.value || 
          latest.ATTRIBUTE?.Address1?.value || 
          latest.ATTRIBUTE?.houseNo?.value || 
          latest.ATTRIBUTE?.HouseNo?.value || 
          latest.ATTRIBUTE?.['เลขที่บ้าน']?.value;
        const projectVal = latest.ATTRIBUTE?.project?.value;
        const orderIdVal = latest.ATTRIBUTE?.['รหัสใบสั่งซื้อ']?.value || latest.ATTRIBUTE?.['รหัสแปลง']?.value;
        const transferDateVal = latest.ATTRIBUTE?.['วันที่โอน']?.value;

        return {
          id: item.id,
          name: item.name,
          label: item.label,
          type: item.type,
          address: addressVal,
          project: projectVal,
          orderId: orderIdVal,
          transferDate: transferDateVal,
          activeTask: activeTaskVal === 'true' || activeTaskVal === true || activeTaskVal === '1',
          techTask: techTaskVal,
          taskTimestamp: taskTs
        };
      });
    } catch (error: any) {
      console.error('Server-side search error:', error.response?.data || error.message);
      return [];
    }
  }

  async searchAssetsByActiveTask(groupName: string = 'Houses'): Promise<AssetInfo[]> {
    console.log(`Searching assets with ActiveTask=true (Server Attribute) in group "${groupName}"...`);
    try {
      // 1. Find the group ID by name (case-insensitive)
      const groupsResponse = await axios.get(`${BASE_URL}/api/entityGroups/ASSET`, {
        params: { pageSize: 100, page: 0 },
        headers: this.headers,
      });
      const groups = groupsResponse.data.data || [];
      const targetGroup = groups.find((g: any) => 
        g.name.toLowerCase() === groupName.toLowerCase() || 
        g.name.toLowerCase() === 'house' || 
        g.name.toLowerCase() === 'houses'
      );
      
      if (!targetGroup) {
        console.warn(`Group "${groupName}" not found for active task search, searching all assets`);
      }

      // 2. Perform entity query with keyFilter on ActiveTask (Server Attribute)
      // We use STRING filter as it's more common for "true" values in TB attributes
      const query = {
        entityFilter: targetGroup ? {
          type: 'entityGroup',
          groupType: 'ASSET',
          entityGroupId: targetGroup.id.id
        } : {
          type: 'assetType',
          assetType: 'House'
        },
        keyFilters: [
          {
            key: { type: 'ATTRIBUTE', key: 'ActiveTask' },
            valueType: 'STRING',
            predicate: {
              type: 'STRING',
              operation: 'EQUAL',
              value: { defaultValue: 'true' }
            }
          }
        ],
        entityFields: [
          { type: 'ENTITY_FIELD', key: 'name' },
          { type: 'ENTITY_FIELD', key: 'label' },
          { type: 'ENTITY_FIELD', key: 'type' }
        ],
        latestValues: [
          { type: 'TIME_SERIES', key: 'ActiveTask' },
          { type: 'TIME_SERIES', key: 'TechTask' },
          { type: 'ATTRIBUTE', key: 'ActiveTask' },
          { type: 'ATTRIBUTE', key: 'TechTask' },
          { type: 'ATTRIBUTE', key: 'address' },
          { type: 'ATTRIBUTE', key: 'Address' },
          { type: 'ATTRIBUTE', key: 'addr' },
          { type: 'ATTRIBUTE', key: 'Addr' },
          { type: 'ATTRIBUTE', key: 'Address1' },
          { type: 'ATTRIBUTE', key: 'houseNo' },
          { type: 'ATTRIBUTE', key: 'HouseNo' },
          { type: 'ATTRIBUTE', key: 'project' },
          { type: 'ATTRIBUTE', key: 'รหัสใบสั่งซื้อ' },
          { type: 'ATTRIBUTE', key: 'วันที่โอน' },
          { type: 'ATTRIBUTE', key: 'รหัสแปลง' },
          { type: 'ATTRIBUTE', key: 'เลขที่บ้าน' }
        ],
        pageLink: {
          pageSize: 16000,
          page: 0,
          sortOrder: {
            key: { type: 'ENTITY_FIELD', key: 'name' },
            direction: 'ASC'
          }
        }
      };

      const response = await axios.post(`${BASE_URL}/api/queries/entities`, query, {
        headers: this.headers,
      });

      const data = response.data.data || [];
      
      // If no results with STRING filter, try BOOLEAN filter
      if (data.length === 0) {
        query.keyFilters[0].valueType = 'BOOLEAN';
        query.keyFilters[0].predicate = {
          type: 'BOOLEAN',
          operation: 'EQUAL',
          value: { defaultValue: true }
        } as any;
        
        const retryResponse = await axios.post(`${BASE_URL}/api/queries/entities`, query, {
          headers: this.headers,
        });
        data.push(...(retryResponse.data.data || []));
      }

      return data.map((item: any) => {
        const latest = item.latest || {};
        // Check both TIME_SERIES and ATTRIBUTE for ActiveTask and TechTask
        const activeTaskVal = latest.ATTRIBUTE?.ActiveTask?.value || latest.TIME_SERIES?.ActiveTask?.value;
        const techTaskVal = latest.ATTRIBUTE?.TechTask?.value || latest.TIME_SERIES?.TechTask?.value;
        const taskTs = latest.ATTRIBUTE?.ActiveTask?.ts || latest.TIME_SERIES?.ActiveTask?.ts || 
                       latest.ATTRIBUTE?.TechTask?.ts || latest.TIME_SERIES?.TechTask?.ts;
        
        const addressVal = 
          latest.ATTRIBUTE?.address?.value || 
          latest.ATTRIBUTE?.Address?.value || 
          latest.ATTRIBUTE?.addr?.value || 
          latest.ATTRIBUTE?.Addr?.value || 
          latest.ATTRIBUTE?.Address1?.value || 
          latest.ATTRIBUTE?.houseNo?.value || 
          latest.ATTRIBUTE?.HouseNo?.value || 
          latest.ATTRIBUTE?.['เลขที่บ้าน']?.value;
        const projectVal = latest.ATTRIBUTE?.project?.value;
        const orderIdVal = latest.ATTRIBUTE?.['รหัสใบสั่งซื้อ']?.value || latest.ATTRIBUTE?.['รหัสแปลง']?.value;
        const transferDateVal = latest.ATTRIBUTE?.['วันที่โอน']?.value;

        return {
          id: item.id,
          name: item.name,
          label: item.label,
          type: item.type,
          address: addressVal,
          project: projectVal,
          orderId: orderIdVal,
          transferDate: transferDateVal,
          activeTask: activeTaskVal === 'true' || activeTaskVal === true || activeTaskVal === '1',
          techTask: techTaskVal,
          taskTimestamp: taskTs
        };
      });
    } catch (error: any) {
      console.error('Active task search error:', error.response?.data || error.message);
      return [];
    }
  }

  async getAssetsByGroup(groupName: string): Promise<AssetInfo[]> {
    console.log('Fetching assets for group with latest values:', groupName);
    try {
      // 1. Find the group ID by name
      const groupsResponse = await axios.get(`${BASE_URL}/api/entityGroups/ASSET`, {
        params: { pageSize: 100, page: 0 },
        headers: this.headers,
      });
      
      const groups = groupsResponse.data.data || [];
      const targetGroup = groups.find((g: any) => g.name === groupName);
      
      if (!targetGroup) {
        console.warn(`Group "${groupName}" not found, falling back to all assets`);
        return this.getAssetsByProfile('House');
      }

      // 2. Use Entity Query to get assets with latest telemetry in one call
      const query = {
        entityFilter: {
          type: 'entityGroup',
          groupType: 'ASSET',
          entityGroupId: targetGroup.id.id
        },
        entityFields: [
          { type: 'ENTITY_FIELD', key: 'name' },
          { type: 'ENTITY_FIELD', key: 'label' },
          { type: 'ENTITY_FIELD', key: 'type' }
        ],
        latestValues: [
          { type: 'TIME_SERIES', key: 'ActiveTask' },
          { type: 'TIME_SERIES', key: 'TechTask' },
          { type: 'ATTRIBUTE', key: 'ActiveTask' },
          { type: 'ATTRIBUTE', key: 'TechTask' },
          { type: 'ATTRIBUTE', key: 'address' },
          { type: 'ATTRIBUTE', key: 'Address' },
          { type: 'ATTRIBUTE', key: 'addr' },
          { type: 'ATTRIBUTE', key: 'Addr' },
          { type: 'ATTRIBUTE', key: 'Address1' },
          { type: 'ATTRIBUTE', key: 'houseNo' },
          { type: 'ATTRIBUTE', key: 'HouseNo' },
          { type: 'ATTRIBUTE', key: 'project' },
          { type: 'ATTRIBUTE', key: 'รหัสใบสั่งซื้อ' },
          { type: 'ATTRIBUTE', key: 'วันที่โอน' },
          { type: 'ATTRIBUTE', key: 'รหัสแปลง' },
          { type: 'ATTRIBUTE', key: 'เลขที่บ้าน' }
        ],
        pageLink: {
          pageSize: 16000,
          page: 0,
          sortOrder: {
            key: { type: 'ENTITY_FIELD', key: 'name' },
            direction: 'ASC'
          }
        }
      };

      const response = await axios.post(`${BASE_URL}/api/queries/entities`, query, {
        headers: this.headers,
      });

      const data = response.data.data || [];
      return data.map((item: any) => {
        const latest = item.latest || {};
        // Check both TIME_SERIES and ATTRIBUTE for ActiveTask and TechTask
        const activeTaskVal = latest.ATTRIBUTE?.ActiveTask?.value || latest.TIME_SERIES?.ActiveTask?.value;
        const techTaskVal = latest.ATTRIBUTE?.TechTask?.value || latest.TIME_SERIES?.TechTask?.value;
        const taskTs = latest.ATTRIBUTE?.ActiveTask?.ts || latest.TIME_SERIES?.ActiveTask?.ts || 
                       latest.ATTRIBUTE?.TechTask?.ts || latest.TIME_SERIES?.TechTask?.ts;
        
        const addressVal = 
          latest.ATTRIBUTE?.address?.value || 
          latest.ATTRIBUTE?.Address?.value || 
          latest.ATTRIBUTE?.addr?.value || 
          latest.ATTRIBUTE?.Addr?.value || 
          latest.ATTRIBUTE?.Address1?.value || 
          latest.ATTRIBUTE?.houseNo?.value || 
          latest.ATTRIBUTE?.HouseNo?.value || 
          latest.ATTRIBUTE?.['เลขที่บ้าน']?.value;
        const projectVal = latest.ATTRIBUTE?.project?.value;
        const orderIdVal = latest.ATTRIBUTE?.['รหัสใบสั่งซื้อ']?.value || latest.ATTRIBUTE?.['รหัสแปลง']?.value;
        const transferDateVal = latest.ATTRIBUTE?.['วันที่โอน']?.value;

        return {
          id: item.id,
          name: item.name,
          label: item.label,
          type: item.type,
          address: addressVal,
          project: projectVal,
          orderId: orderIdVal,
          transferDate: transferDateVal,
          activeTask: activeTaskVal === 'true' || activeTaskVal === true || activeTaskVal === '1',
          techTask: techTaskVal,
          taskTimestamp: taskTs
        };
      });
    } catch (error: any) {
      console.error('Error fetching assets by group:', error.response?.data || error.message);
      // Fallback to profile fetch if group API fails (e.g. if CE version)
      return this.getAssetsByProfile('House');
    }
  }

  async getLatestTelemetry(entityId: string, keys: string[], entityType: string = 'DEVICE'): Promise<TelemetryResponse> {
    console.log(`Fetching latest telemetry for ${entityType}:`, entityId, 'keys:', keys);
    try {
      const response = await axios.get(`${BASE_URL}/api/plugins/telemetry/${entityType}/${entityId}/values/timeseries`, {
        params: {
          keys: keys.join(','),
        },
        headers: this.headers,
      });
      return response.data;
    } catch (error: any) {
      console.error('Telemetry fetch error:', error.response?.data || error.message);
      throw error;
    }
  }

  async getTimeseries(entityId: string, keys: string[], startTs: number, endTs: number, limit: number = 1000, entityType: string = 'DEVICE'): Promise<TelemetryResponse> {
    console.log(`Fetching timeseries for ${entityType}:`, entityId, 'keys:', keys);
    try {
      const response = await axios.get(`${BASE_URL}/api/plugins/telemetry/${entityType}/${entityId}/values/timeseries`, {
        params: {
          keys: keys.join(','),
          startTs,
          endTs,
          limit,
          useStrictDataTypes: true
        },
        headers: this.headers,
      });
      return response.data;
    } catch (error: any) {
      console.error('Timeseries fetch error:', error.response?.data || error.message);
      throw error;
    }
  }

  async sendRpcCommand(deviceId: string, method: string, params: any = {}, isTwoWay: boolean = false): Promise<any> {
    console.log(`Sending ${isTwoWay ? 'two-way' : 'one-way'} RPC command "${method}" to device:`, deviceId);
    const type = isTwoWay ? 'twoway' : 'oneway';
    try {
      const response = await axios.post(`${BASE_URL}/api/plugins/rpc/${type}/${deviceId}`, {
        method,
        params,
        }, {
        headers: this.headers,
      });
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 409) {
        console.error('RPC command error: Device is offline or disconnected (409)');
        throw new Error('Device is offline. Please check its connection.');
      }
      console.error('RPC command error:', error.response?.data || error.message);
      throw error;
    }
  }

  async saveTelemetry(entityId: string, telemetry: any, entityType: string = 'DEVICE', scope: string = 'ANY'): Promise<void> {
    console.log(`Saving telemetry for ${entityType}:`, entityId, telemetry);
    try {
      await axios.post(`${BASE_URL}/api/plugins/telemetry/${entityType}/${entityId}/timeseries/${scope}`, telemetry, {
        headers: this.headers,
      });
    } catch (error: any) {
      console.error('Save telemetry error:', error.response?.data || error.message);
      throw error;
    }
  }

  async saveRelation(relation: Relation): Promise<void> {
    console.log('Saving relation:', relation);
    try {
      await axios.post(`${BASE_URL}/api/relation`, relation, {
        headers: this.headers,
      });
    } catch (error: any) {
      console.error('Save relation error:', error.response?.data || error.message);
      throw error;
    }
  }

  async getUserGroups(): Promise<any[]> {
    console.log('Fetching user groups...');
    try {
      // First get current user info to get user ID
      const userResponse = await axios.get(`${BASE_URL}/api/auth/user`, {
        headers: this.headers,
      });
      const userId = userResponse.data.id.id;
      const userEmail = userResponse.data.email;
      
      console.log('Checking groups for user:', userEmail, 'ID:', userId);

      // Fetch all user groups available to this user
      const groupsResponse = await axios.get(`${BASE_URL}/api/entityGroups/USER`, {
        params: { pageSize: 100, page: 0 },
        headers: this.headers,
      });
      
      const allGroups = groupsResponse.data.data || [];
      const techAppGroup = allGroups.find((g: any) => g.name === 'TechApp');
      
      if (techAppGroup) {
        // STRICT MEMBERSHIP CHECK: 
        // We must verify the user is explicitly in the TechApp group's entity list.
        try {
          const membersResponse = await axios.get(`${BASE_URL}/api/entityGroup/${techAppGroup.id.id}/entities`, {
            params: { pageSize: 1000, page: 0 }, // Use larger page size to be sure
            headers: this.headers,
          });
          const members = membersResponse.data.data || [];
          const isMember = members.some((m: any) => m.id.id === userId);
          
          if (isMember) {
            console.log('User', userEmail, 'is a confirmed member of TechApp');
            return [techAppGroup];
          } else {
            console.log('User', userEmail, 'is NOT a member of TechApp group (membership check failed)');
          }
        } catch (e) {
          console.warn('Failed to verify group membership for TechApp:', e);
        }
      } else {
        console.log('TechApp group not found in accessible groups for', userEmail);
      }
      
      return [];
    } catch (error: any) {
      console.error('User groups fetch error:', error.response?.data || error.message);
      return [];
    }
  }

}

export const tbService = new ThingsboardService();
