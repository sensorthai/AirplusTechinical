import React, { useState, useEffect } from 'react';
import { 
  ArrowLeft, 
  Share2, 
  TrendingDown, 
  TrendingUp, 
  Minus, 
  Clock, 
  Home, 
  BarChart3, 
  Smartphone,
  Settings, 
  Power, 
  Zap, 
  Wind, 
  Fan,
  Filter,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Loader2,
  Scan,
  Search,
  X,
  Bell,
  User,
  RotateCcw,
  DownloadCloud
} from 'lucide-react';
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid,
  Tooltip, 
  ResponsiveContainer 
} from 'recharts';
import { motion, AnimatePresence } from 'motion/react';
import { Html5Qrcode } from 'html5-qrcode';
import { Toaster, toast } from 'sonner';
import { tbService, AssetInfo, TelemetryValue } from './services/thingsboard';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// --- Types ---
type Screen = 'login' | 'assets' | 'stats' | 'fans' | 'settings';

interface TelemetryData {
  pm_1: string;
  pm_2: string;
  temperature?: string;
  humidity?: string;
  lastUpdate?: number;
  fan_1_status?: string;
  filter_1_counter?: number;
  filter_2_counter?: number;
  airintake_1_status?: string;
  relays?: { [key: string]: string };
  deviceName?: string;
  active?: boolean;
  pm_1_status?: string;
  pm_2_status?: string;
  // Settings Attributes
  controller_state?: string;
  board_detail?: string;
  board_type?: string;
  datetime?: string;
  firmware_version?: string;
  rs485_status?: string;
  uptime?: string;
  status?: string;
  pm_1_moving_avg?: string;
  pm_2_moving_avg?: string;
  OTAStatus?: string;
  OTAProgress?: number;
  cpu_temp_c?: string;
}

// --- Components ---

const QRScannerEffect = ({ onScanSuccess }: { onScanSuccess: (text: string) => void }) => {
  useEffect(() => {
    const html5QrCode = new Html5Qrcode("reader");
    const config = { fps: 10, qrbox: { width: 250, height: 250 } };

    html5QrCode.start(
      { facingMode: "environment" },
      config,
      (decodedText) => {
        onScanSuccess(decodedText);
      },
      () => {
        // silent error for each frame
      }
    ).catch((err) => {
      console.error("Unable to start scanning", err);
    });

    return () => {
      const stopScanner = async () => {
        if (html5QrCode.isScanning) {
          try {
            await html5QrCode.stop();
          } catch (err) {
            console.error("Failed to stop scanner", err);
          }
        }
      };
      stopScanner();
    };
  }, [onScanSuccess]);

  return null;
};

const Card = ({ children, className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 p-4 rounded-xl shadow-sm", className)} {...props}>
    {children}
  </div>
);

const StatCard = ({ label, value, unit, trend, trendValue, trendType }: { 
  label: string; 
  value: string; 
  unit: string; 
  trend?: 'up' | 'down' | 'neutral';
  trendValue?: string;
  trendType?: 'positive' | 'negative' | 'neutral';
}) => (
  <Card className="p-4">
    <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">{label}</p>
    <p className="text-xl font-bold">{value} <span className="text-xs font-normal">{unit}</span></p>
    {trend && (
      <div className={cn(
        "flex items-center gap-1 mt-1",
        trendType === 'positive' ? "text-emerald-500" : trendType === 'negative' ? "text-rose-500" : "text-slate-400"
      )}>
        {trend === 'up' && <TrendingUp size={12} />}
        {trend === 'down' && <TrendingDown size={12} />}
        {trend === 'neutral' && <Minus size={12} />}
        <span className="text-[10px] font-bold">{trendValue}</span>
      </div>
    )}
  </Card>
);

const formatUptime = (uptime: string | undefined) => {
  if (!uptime) return 'N/A';
  // Expected format: 0T14:09:44
  try {
    const parts = uptime.split('T');
    if (parts.length !== 2) return uptime;
    
    const days = parseInt(parts[0]);
    const timeParts = parts[1].split(':');
    if (timeParts.length !== 3) return uptime;
    
    const hours = parseInt(timeParts[0]);
    const minutes = parseInt(timeParts[1]);
    
    let result = '';
    if (days > 0) result += `${days}d `;
    if (hours > 0 || days > 0) result += `${hours}h `;
    result += `${minutes}m`;
    
    return result.trim() || '0m';
  } catch (e) {
    return uptime;
  }
};

export default function App() {
  const [screen, setScreen] = useState<Screen>('login');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [assets, setAssets] = useState<AssetInfo[]>([]);
  const [initialAssets, setInitialAssets] = useState<AssetInfo[]>([]);
  const [selectedAsset, setSelectedAsset] = useState<AssetInfo | null>(null);
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [telemetry, setTelemetry] = useState<TelemetryData | null>(null);
  const [userGroups, setUserGroups] = useState<any[]>([]);
  const [indoorHistory, setIndoorHistory] = useState<any[]>([]);
  const [outdoorHistory, setOutdoorHistory] = useState<any[]>([]);
  const [tab, setTab] = useState<'indoor' | 'outdoor'>('indoor');
  const [duration, setDuration] = useState('24h');
  const [searchTerm, setSearchTerm] = useState('');
  const [recentSearches, setRecentSearches] = useState<string[]>(() => {
    const saved = localStorage.getItem('recentSearches');
    return saved ? JSON.parse(saved) : [];
  });

  useEffect(() => {
    localStorage.setItem('recentSearches', JSON.stringify(recentSearches));
  }, [recentSearches]);

  const isTechAppUser = userGroups.some(g => g.name === 'TechApp');

  const addToRecentSearches = (term: string) => {
    const trimmed = term.trim();
    if (!trimmed) return;
    setRecentSearches(prev => {
      const filtered = prev.filter(t => t !== trimmed);
      return [trimmed, ...filtered].slice(0, 5);
    });
  };

  const [isScanning, setIsScanning] = useState(false);

  // Login credentials from user request
  const [username, setUsername] = useState('inst.wsa@gmail.com');
  const [password, setPassword] = useState('654321wsa');

  const [isSearching, setIsSearching] = useState(false);

  const [confirmAction, setConfirmAction] = useState<{
    title: string;
    message: string;
    onConfirm: () => void;
  } | null>(null);

  const [expandedAirintake, setExpandedAirintake] = useState(true);
  const [expandedFanPM25, setExpandedFanPM25] = useState(true);
  const [expandedVentilation, setExpandedVentilation] = useState(true);

  // API-based search with debounce
  useEffect(() => {
    const delayDebounceFn = setTimeout(async () => {
      if (searchTerm.trim() === '') {
        setAssets(initialAssets);
        return;
      }

      setIsSearching(true);
      try {
        const foundAssets = await tbService.searchAssetsInGroup('Houses', searchTerm);

        // Fetch attributes for found assets to show address
        const assetsWithAttrs = await Promise.all(foundAssets.map(async (asset) => {
          try {
            const attrs = await tbService.getAllAttributes('ASSET', asset.id.id);
            const addressAttr = attrs.find((a: any) => 
              a.key.toLowerCase() === 'address' || 
              a.key.toLowerCase().includes('address') ||
              a.key.toLowerCase() === 'addr'
            );
            const orderIdAttr = attrs.find((a: any) => a.key === 'รหัสใบสั่งซื้อ');
            const transferDateAttr = attrs.find((a: any) => a.key === 'วันที่โอน');
            const projectAttr = attrs.find((a: any) => a.key === 'project');
            
            return { 
              ...asset, 
              address: addressAttr ? String(addressAttr.value) : undefined,
              orderId: orderIdAttr ? String(orderIdAttr.value) : undefined,
              transferDate: transferDateAttr ? String(transferDateAttr.value) : undefined,
              project: projectAttr ? String(projectAttr.value) : undefined
            };
          } catch (e) {
            return asset;
          }
        }));

        setAssets(assetsWithAttrs);
      } catch (err) {
        console.error('Search error:', err);
      } finally {
        setIsSearching(false);
      }
    }, 500);

    return () => clearTimeout(delayDebounceFn);
  }, [searchTerm, initialAssets]);
  const handleLogin = async () => {
    setLoading(true);
    setError(null);
    try {
      await tbService.login(username, password);
      
      // Fetch user groups
      const groups = await tbService.getUserGroups();
      setUserGroups(groups);
      
      // Fetch assets from the "Houses" group
      let allAssets = await tbService.getAssetsByGroup('Houses');
      
      // If "Houses" group is empty or not found, try fetching all assets as a fallback
      if (allAssets.length === 0) {
        console.log('Houses group empty, fetching all assets...');
        allAssets = await tbService.getAssetsByProfile('');
      }
      
      setAssets(allAssets);
      setInitialAssets(allAssets);
      setScreen('assets');
    } catch (err: any) {
      setError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectAsset = async (asset: AssetInfo) => {
    if (searchTerm.trim()) {
      addToRecentSearches(searchTerm);
    }
    setLoading(true);
    let updatedAsset = { ...asset };
    
    // If attributes are missing, fetch them (since we removed pre-fetch)
    try {
      const attrs = await tbService.getAllAttributes('ASSET', asset.id.id);
      const addressAttr = attrs.find((a: any) => 
        a.key.toLowerCase() === 'address' || 
        a.key.toLowerCase().includes('address') ||
        a.key.toLowerCase() === 'addr'
      );
      const orderIdAttr = attrs.find((a: any) => a.key === 'รหัสใบสั่งซื้อ');
      const transferDateAttr = attrs.find((a: any) => a.key === 'วันที่โอน');
      const projectAttr = attrs.find((a: any) => a.key === 'project');
      
      updatedAsset = { 
        ...asset, 
        address: addressAttr ? String(addressAttr.value) : asset.address,
        orderId: orderIdAttr ? String(orderIdAttr.value) : asset.orderId,
        transferDate: transferDateAttr ? String(transferDateAttr.value) : asset.transferDate,
        project: projectAttr ? String(projectAttr.value) : asset.project
      };
    } catch (e) {
      console.error('Error fetching asset attributes:', e);
    }

    setSelectedAsset(updatedAsset);
    setSearchTerm('');
    setIsScanning(false);
    try {
      const relations = await tbService.getAssetRelations(asset.id.id);
      // Find the first device relation
      const deviceRelation = relations.find(r => r.to.entityType === 'DEVICE');
      if (deviceRelation) {
        setDeviceId(deviceRelation.to.id);
        await fetchTelemetry(deviceRelation.to.id);
        setScreen('stats');
      } else {
        setError('No device found for this house');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to fetch relations');
    } finally {
      setLoading(false);
    }
  };

  const handleScanSuccess = React.useCallback(async (decodedText: string) => {
    setIsScanning(false);
    setLoading(true);
    
    try {
      // 1. Try to find asset directly
      const foundAsset = assets.find(a => a.name === decodedText || a.id.id === decodedText);
      if (foundAsset) {
        handleSelectAsset(foundAsset);
        return;
      }

      // 2. Search API for the text (restricted to Houses group)
      const searchResults = await tbService.searchAssetsInGroup('Houses', decodedText);
      if (searchResults.length > 0) {
        handleSelectAsset(searchResults[0]);
        return;
      }

      toast.error(`No house found matching: ${decodedText}`);
    } catch (err) {
      console.error('Scan lookup error:', err);
      toast.error('Error looking up scanned code');
    } finally {
      setLoading(false);
    }
  }, [assets, handleSelectAsset]);

  const handleReboot = async () => {
    if (!deviceId) return;
    setConfirmAction({
      title: 'Reboot Device',
      message: 'Are you sure you want to reboot the device?',
      onConfirm: async () => {
        setLoading(true);
        try {
          await tbService.sendRpcCommand(deviceId, 'systemREBOOT', 'RUN', false);
          toast.success('Reboot command sent successfully');
        } catch (err: any) {
          toast.error('Failed to send reboot command: ' + (err.response?.data?.message || err.message));
        } finally {
          setLoading(false);
          setConfirmAction(null);
        }
      }
    });
  };

  const handleOTAUpdate = async () => {
    if (!deviceId) return;
    setConfirmAction({
      title: 'OTA Update',
      message: 'Are you sure you want to trigger an OTA update?',
      onConfirm: async () => {
        setLoading(true);
        try {
          await tbService.sendRpcCommand(deviceId, 'OTAUpdate', 'RUN', false);
          toast.success('OTA update command sent successfully');
        } catch (err: any) {
          toast.error('Failed to trigger OTA update: ' + (err.response?.data?.message || err.message));
        } finally {
          setLoading(false);
          setConfirmAction(null);
        }
      }
    });
  };

  const handleRelayMode = async (relayId: number, mode: string) => {
    if (!deviceId) return;
    
    const method = 'setModeFan_AIRPLUS';
    const params = { [`SetRelay${relayId}`]: mode };
    
    setConfirmAction({
      title: `Set Fan ${relayId} to ${mode}`,
      message: `Are you sure you want to set Ventilation Fan ${relayId} to ${mode}?`,
      onConfirm: async () => {
        setLoading(true);
        try {
          await tbService.sendRpcCommand(deviceId, method, params, false);
          toast.success(`Ventilation Fan ${relayId} set to ${mode}`);
        } catch (err: any) {
          toast.error(`Failed: ${err.response?.data?.message || err.message}`);
        } finally {
          setLoading(false);
          setConfirmAction(null);
        }
      }
    });
  };

  const handleFanCommand = async (type: 'mode' | 'speed' | 'addr' | 'airintake_mode' | 'airintake_addr', fanId: number, value?: string) => {
    if (!deviceId) return;
    
    let method = '';
    let params: any = {};
    let title = '';
    let message = '';

    if (type === 'mode') {
      method = `setModeFan_${fanId}`;
      params = value?.toUpperCase();
      title = `Set Fan ${fanId} Mode`;
      message = `Set Fan ${fanId} to ${value}?`;
    } else if (type === 'speed') {
      method = `setSpeedFan_${fanId}`;
      params = value?.toUpperCase();
      title = `Set Fan ${fanId} Speed`;
      message = `Set Fan ${fanId} speed to ${value}?`;
    } else if (type === 'addr') {
      method = `setAddrFan_${fanId}`;
      params = {};
      title = `Set Fan ${fanId} Address`;
      message = `Trigger SET ADDR for Fan ${fanId}?`;
    } else if (type === 'airintake_mode') {
      method = `setModeAirInTake_${fanId}`;
      params = value?.toUpperCase();
      title = `Set Airintake ${fanId} Mode`;
      message = `Set Airintake ${fanId} to ${value}?`;
    } else if (type === 'airintake_addr') {
      method = `setAddrAirInTake_${fanId}`;
      params = {};
      title = `Set Airintake ${fanId} Address`;
      message = `Trigger SET ADDR for Airintake ${fanId}?`;
    }

    setConfirmAction({
      title,
      message,
      onConfirm: async () => {
        setLoading(true);
        try {
          await tbService.sendRpcCommand(deviceId, method, params, false);
          toast.success(`${title} command sent`);
        } catch (err: any) {
          toast.error(`Failed: ${err.response?.data?.message || err.message}`);
        } finally {
          setLoading(false);
          setConfirmAction(null);
        }
      }
    });
  };

  useEffect(() => {
    if (deviceId && (screen === 'stats' || screen === 'fans' || screen === 'settings')) {
      fetchTelemetry(deviceId, duration);
      
      const interval = setInterval(() => {
        fetchTelemetry(deviceId, duration);
      }, 5000);
      
      return () => clearInterval(interval);
    }
  }, [deviceId, screen, duration]);

  const fetchTelemetry = async (id: string, currentDuration: string = duration) => {
    try {
      const attributeKeys = [
        'fan_1_status', 
        'fan_1_mode',
        'fan_1_rpm',
        'fan_1_rs485',
        'fan_2_status', 
        'fan_2_mode',
        'fan_2_rpm',
        'fan_2_rs485',
        'fan_3_status', 
        'fan_3_mode',
        'fan_3_rpm',
        'fan_3_rs485',
        'airintake_1_mode',
        'airintake_1_status',
        'airintake_1_rs485',
        'airintake_2_mode',
        'airintake_2_status',
        'airintake_2_rs485',
        'filter_1_counter', 
        'filter_2_counter',
        'airintake_1_status', 
        'relay_status', 
        'name',
        'board_detail',
        'board_type',
        'datetime',
        'firmware_version',
        'rs485_status',
        'uptime',
        'status',
        'OTAStatus',
        'OTAProgress'
      ];

      // Calculate start and end time based on duration
      const endTs = Date.now();
      let startTs = endTs - 24 * 3600000; // Default 24h
      if (currentDuration === '1h') startTs = endTs - 3600000;
      else if (currentDuration === '6h') startTs = endTs - 6 * 3600000;
      else if (currentDuration === '7d') startTs = endTs - 7 * 24 * 3600000;

      const [telemetryData, clientAttributes, serverAttributes, timeseriesData] = await Promise.all([
        tbService.getLatestTelemetry(id, ['pm_1', 'pm_2', 'temperature', 'humidity', 'controller_state', 'pm_1_moving_avg', 'pm_2_moving_avg', 'cpu_temp_c']),
        tbService.getAttributes('DEVICE', id, 'CLIENT_SCOPE', attributeKeys),
        tbService.getAttributes('DEVICE', id, 'SERVER_SCOPE', ['active', 'pm_1_status', 'pm_2_status']),
        tbService.getTimeseries(id, ['pm_1_moving_avg', 'pm_2_moving_avg'], startTs, endTs, 1000)
      ]);

      // Helper to find attribute value
      const getAttr = (key: string) => clientAttributes.find((a: any) => a.key === key)?.value;
      const getServerAttr = (key: string) => serverAttributes.find((a: any) => a.key === key)?.value;

      // Extract active status
      const active = getServerAttr('active') === true;

      // Extract device name
      const deviceName = String(getAttr('name') || id);

      // Extract fan status
      const fanStatus = String(getAttr('fan_1_status') || 'Auto');

      // Extract filter counter
      const filterCounter = Number(getAttr('filter_1_counter') || 3400);

      // Extract air intake status
      const airIntakeStatus = String(getAttr('airintake_1_status') || 'Auto');

      // Extract relay status
      const relayStatusValue = getAttr('relay_status');
      let relayMap: { [key: string]: string } = {};
      
      if (relayStatusValue) {
        try {
          const relayJson = typeof relayStatusValue === 'string' 
            ? JSON.parse(relayStatusValue) 
            : relayStatusValue;
          
          for (let i = 1; i <= 16; i++) {
            const key = `relay_${i}_status`;
            if (relayJson[key] && relayJson[key].status) {
              relayMap[i] = relayJson[key].status;
            } else {
              relayMap[i] = 'OFF';
            }
          }
        } catch (e) {
          console.error('Error parsing relay_status JSON:', e);
        }
      }

      setTelemetry({
        pm_1: telemetryData.pm_1?.[0]?.value || '0',
        pm_2: telemetryData.pm_2?.[0]?.value || '0',
        temperature: telemetryData.temperature?.[0]?.value || '22',
        humidity: telemetryData.humidity?.[0]?.value || '45',
        lastUpdate: telemetryData.pm_1?.[0]?.ts || Date.now(),
        fan_1_status: fanStatus,
        filter_1_counter: filterCounter,
        relays: relayMap,
        deviceName: deviceName,
        active: active,
        pm_1_status: String(getServerAttr('pm_1_status') || '-'),
        pm_2_status: String(getServerAttr('pm_2_status') || '-'),
        fan_1_mode: String(getAttr('fan_1_mode') || '-'),
        fan_1_rpm: String(getAttr('fan_1_rpm') || '-'),
        fan_1_rs485: String(getAttr('fan_1_rs485') || '-'),
        fan_2_status: String(getAttr('fan_2_status') || '-'),
        fan_2_mode: String(getAttr('fan_2_mode') || '-'),
        fan_2_rpm: String(getAttr('fan_2_rpm') || '-'),
        fan_2_rs485: String(getAttr('fan_2_rs485') || '-'),
        fan_3_status: String(getAttr('fan_3_status') || '-'),
        fan_3_mode: String(getAttr('fan_3_mode') || '-'),
        fan_3_rpm: String(getAttr('fan_3_rpm') || '-'),
        fan_3_rs485: String(getAttr('fan_3_rs485') || '-'),
        airintake_1_mode: String(getAttr('airintake_1_mode') || '-'),
        airintake_1_status: String(getAttr('airintake_1_status') || '-'),
        airintake_1_rs485: String(getAttr('airintake_1_rs485') || '-'),
        airintake_2_mode: String(getAttr('airintake_2_mode') || '-'),
        airintake_2_status: String(getAttr('airintake_2_status') || '-'),
        airintake_2_rs485: String(getAttr('airintake_2_rs485') || '-'),
        // Settings Attributes
        controller_state: String(telemetryData.controller_state?.[0]?.value || '-'),
        board_detail: String(getAttr('board_detail') || '-'),
        board_type: String(getAttr('board_type') || '-'),
        datetime: String(getAttr('datetime') || '-'),
        firmware_version: String(getAttr('firmware_version') || '-'),
        rs485_status: String(getAttr('rs485_status') || '-'),
        uptime: String(getAttr('uptime') || '-'),
        status: String(getAttr('status') || '-'),
        filter_2_counter: Number(getAttr('filter_2_counter') || 0),
        pm_1_moving_avg: telemetryData.pm_1_moving_avg?.[0]?.value || '-',
        pm_2_moving_avg: telemetryData.pm_2_moving_avg?.[0]?.value || '-',
        cpu_temp_c: telemetryData.cpu_temp_c?.[0]?.value || '-',
        OTAStatus: String(getAttr('OTAStatus') || 'Idle'),
        OTAProgress: Number(getAttr('OTAProgress') || 0)
      });

      // Process indoor history
      if (timeseriesData.pm_1_moving_avg && timeseriesData.pm_1_moving_avg.length > 0) {
        const processed = timeseriesData.pm_1_moving_avg.map((item: any) => ({
          time: new Date(item.ts).toLocaleTimeString([], { 
            hour: '2-digit', 
            minute: '2-digit',
            ...(currentDuration === '7d' ? { day: 'numeric', month: 'short' } : {})
          }),
          pm25: parseFloat(item.value),
          ts: item.ts
        })).reverse();
        setIndoorHistory(processed);
      } else {
        // Mock if no data
        const now = Date.now();
        setIndoorHistory(Array.from({ length: 24 }).map((_, i) => ({
          time: new Date(now - (23 - i) * 3600000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          pm25: Math.floor(Math.random() * 15) + 5,
        })));
      }

      // Process outdoor history
      if (timeseriesData.pm_2_moving_avg && timeseriesData.pm_2_moving_avg.length > 0) {
        const processed = timeseriesData.pm_2_moving_avg.map((item: any) => ({
          time: new Date(item.ts).toLocaleTimeString([], { 
            hour: '2-digit', 
            minute: '2-digit',
            ...(currentDuration === '7d' ? { day: 'numeric', month: 'short' } : {})
          }),
          pm25: parseFloat(item.value),
          ts: item.ts
        })).reverse();
        setOutdoorHistory(processed);
      } else {
        // Mock if no data
        const now = Date.now();
        setOutdoorHistory(Array.from({ length: 24 }).map((_, i) => ({
          time: new Date(now - (23 - i) * 3600000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          pm25: Math.floor(Math.random() * 25) + 10,
        })));
      }
    } catch (err) {
      console.error('Telemetry fetch error', err);
    }
  };

  // --- Renderers ---

  if (screen === 'login') {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <Toaster position="top-center" richColors />
        <div className="w-full max-w-md bg-white rounded-3xl shadow-xl p-8">
          <div className="flex flex-col items-center mb-8">
            <div className="size-16 bg-primary rounded-2xl flex items-center justify-center text-white mb-4 shadow-lg shadow-primary/20">
              <Wind size={32} />
            </div>
            <h1 className="text-2xl font-bold text-slate-900">AirPlus Smart</h1>
            <p className="text-slate-500 text-sm">Connect to your home sensor</p>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1 ml-1">Email</label>
              <input 
                type="email" 
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-slate-50 border-none focus:ring-2 focus:ring-primary/20 transition-all"
                placeholder="email@example.com"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1 ml-1">Password</label>
              <input 
                type="password" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-slate-50 border-none focus:ring-2 focus:ring-primary/20 transition-all"
                placeholder="••••••••"
              />
            </div>
            
            {error && (
              <div className="bg-rose-50 border border-rose-100 p-3 rounded-xl">
                <p className="text-rose-500 text-xs font-medium text-center">
                  {error.includes('400') ? 'Invalid credentials or malformed request (400)' : error}
                </p>
                <p className="text-[10px] text-rose-400 text-center mt-1">Please check your username/password or API endpoint.</p>
              </div>
            )}

            <button 
              onClick={handleLogin}
              disabled={loading}
              className="w-full py-4 bg-primary text-white rounded-xl font-bold shadow-lg shadow-primary/30 hover:opacity-90 transition-all flex items-center justify-center gap-2"
            >
              {loading ? <Loader2 className="animate-spin" size={20} /> : 'Sign In'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (screen === 'assets') {
    // We now use assets state directly as it is updated by API search
    const filteredAssets = assets;

    return (
      <div className="min-h-screen bg-slate-50 flex flex-col">
        <Toaster position="top-center" richColors />
        {confirmAction && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-6 z-[100] backdrop-blur-sm">
            <div className="w-full max-w-xs bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-2xl">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">{confirmAction.title}</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">{confirmAction.message}</p>
              <div className="flex gap-3">
                <button 
                  onClick={() => setConfirmAction(null)}
                  className="flex-1 py-3 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold rounded-xl"
                >
                  Cancel
                </button>
                <button 
                  onClick={confirmAction.onConfirm}
                  className="flex-1 py-3 bg-primary text-white font-bold rounded-xl shadow-lg shadow-primary/20"
                >
                  Confirm
                </button>
              </div>
            </div>
          </div>
        )}
        <header className="p-6 bg-white border-b border-slate-100">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-xl font-bold text-slate-900">Select House</h1>
              <p className="text-slate-500 text-sm">Choose an asset to monitor</p>
            </div>
            <button 
              onClick={() => setIsScanning(!isScanning)}
              className={cn(
                "size-12 rounded-xl flex items-center justify-center transition-all",
                isScanning ? "bg-rose-100 text-rose-500" : "bg-primary/10 text-primary"
              )}
            >
              {isScanning ? <X size={24} /> : <Scan size={24} />}
            </button>
          </div>

          {!isScanning && (
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input 
                type="text"
                placeholder="Search by address..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-10 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
              />
              {isSearching ? (
                <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 text-primary animate-spin" size={18} />
              ) : searchTerm && (
                <button 
                  onClick={() => setSearchTerm('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X size={18} />
                </button>
              )}
            </div>
          )}

          {!isScanning && recentSearches.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider py-1">Recent:</span>
              {recentSearches.map((term, i) => (
                <button
                  key={i}
                  onClick={() => setSearchTerm(term)}
                  className="px-2 py-1 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-md text-[10px] font-medium text-slate-600 dark:text-slate-300 transition-colors"
                >
                  {term}
                </button>
              ))}
              <button
                onClick={() => setRecentSearches([])}
                className="px-2 py-1 text-[10px] font-bold text-rose-400 hover:text-rose-500 transition-colors"
              >
                Clear
              </button>
            </div>
          )}
        </header>

        <main className="flex-1 p-6 space-y-4">
          {isScanning && (
            <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
              <h3 className="font-bold text-center mb-4">Scan House QR Code</h3>
              <div id="reader" className="w-full aspect-square rounded-xl overflow-hidden"></div>
              <p className="text-xs text-slate-500 text-center mt-4">Position the QR code within the frame</p>
              
              {/* Initialize scanner when isScanning is true */}
              <QRScannerEffect onScanSuccess={handleScanSuccess} />
            </div>
          )}

          {!isScanning && (
            <>
              {filteredAssets.length === 0 && !loading && (
                <div className="text-center py-12">
                  <Home className="mx-auto text-slate-300 mb-4" size={48} />
                  {searchTerm.trim() === '' ? (
                    <p className="text-slate-500 px-6 font-medium">Search for a house by address to get started</p>
                  ) : (
                    <p className="text-slate-500 px-6">No houses found matching "{searchTerm}"</p>
                  )}
                </div>
              )}
              
              {/* Show Assets */}
              {filteredAssets.map((asset) => (
                <button 
                  key={asset.id.id}
                  onClick={() => handleSelectAsset(asset)}
                  className="w-full bg-white p-5 rounded-2xl shadow-sm border border-slate-100 flex items-center justify-between hover:border-primary transition-all group"
                >
                  <div className="flex items-center gap-4">
                    <div className="size-12 bg-slate-50 rounded-xl flex items-center justify-center text-slate-400 group-hover:bg-primary/10 group-hover:text-primary transition-all">
                      <Home size={24} />
                    </div>
                    <div className="text-left">
                      <h3 className="font-bold text-slate-900">{asset.name}</h3>
                      <p className="text-xs text-slate-500">{asset.address || asset.label || 'Residential House'}</p>
                    </div>
                  </div>
                  <ChevronRight className="text-slate-300 group-hover:text-primary transition-all" size={20} />
                </button>
              ))}
            </>
          )}
          
          {loading && (
            <div className="flex justify-center py-12">
              <Loader2 className="animate-spin text-primary" size={32} />
            </div>
          )}
        </main>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto bg-white dark:bg-slate-900 min-h-screen flex flex-col shadow-xl">
      <Toaster position="top-center" richColors />
      {confirmAction && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-6 z-[100] backdrop-blur-sm">
          <div className="w-full max-w-xs bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-2xl">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">{confirmAction.title}</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">{confirmAction.message}</p>
            <div className="flex gap-3">
              <button 
                onClick={() => setConfirmAction(null)}
                className="flex-1 py-3 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold rounded-xl"
              >
                Cancel
              </button>
              <button 
                onClick={confirmAction.onConfirm}
                className="flex-1 py-3 bg-primary text-white font-bold rounded-xl shadow-lg shadow-primary/20"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Header */}
      <header className="flex items-center p-4 sticky top-0 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md z-10 border-b border-slate-100 dark:border-slate-800">
        <button 
          onClick={() => setScreen('assets')}
          className="size-10 flex items-center justify-center rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
        >
          <ArrowLeft size={20} />
        </button>
        <div className="flex-1 text-center">
          <div className="flex items-center justify-center gap-1.5">
            <h1 className="text-lg font-bold tracking-tight">{telemetry?.deviceName || selectedAsset?.name || 'AirPlus Square'}</h1>
            <span className={cn(
              "size-2 rounded-full",
              telemetry?.active ? "bg-emerald-500" : "bg-rose-500"
            )}></span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium uppercase tracking-wider flex items-center justify-center gap-2">
            <span>{screen === 'stats' ? 'Living Room Sensor' : 'Control Panel'}</span>
            {telemetry?.controller_state && telemetry.controller_state !== '-' && (
              <>
                <span className="size-1 rounded-full bg-slate-300 dark:bg-slate-600"></span>
                <span className="text-primary font-bold">{telemetry.controller_state}</span>
              </>
            )}
          </p>
        </div>
        <button className="size-10 flex items-center justify-center rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
          <Bell size={20} />
        </button>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto pb-24">
        {screen === 'stats' && (
          <div className="p-4">
            {/* House Information at the top */}
            <Card className="p-4 mb-6 bg-primary/5 border-primary/10">
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 bg-primary/10 text-primary rounded-lg">
                  <Home size={20} />
                </div>
                <h2 className="font-bold text-slate-900 dark:text-white">House Information</h2>
              </div>
              <div className="grid grid-cols-1 gap-2">
                <div className="flex justify-between items-center">
                  <span className="text-xs text-slate-500 font-medium">Address</span>
                  <span className="text-xs font-bold text-slate-900 dark:text-slate-200">{selectedAsset?.address || '-'}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-slate-500 font-medium">Order ID</span>
                  <span className="text-xs font-bold text-slate-900 dark:text-slate-200">{selectedAsset?.orderId || '-'}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-slate-500 font-medium">Project</span>
                  <span className="text-xs font-bold text-slate-900 dark:text-slate-200">{selectedAsset?.project || '-'}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-slate-500 font-medium">Transfer Date</span>
                  <span className="text-xs font-bold text-slate-900 dark:text-slate-200">{selectedAsset?.transferDate || '-'}</span>
                </div>
              </div>
            </Card>

            {/* Tab Switcher */}
            <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl mb-6">
              <button 
                onClick={() => setTab('indoor')}
                className={cn(
                  "flex-1 py-2 px-4 rounded-lg text-sm font-bold transition-all",
                  tab === 'indoor' ? "bg-white dark:bg-slate-700 shadow-sm text-slate-900 dark:text-slate-100" : "text-slate-500 dark:text-slate-400"
                )}
              >
                Indoor
              </button>
              <button 
                onClick={() => setTab('outdoor')}
                className={cn(
                  "flex-1 py-2 px-4 rounded-lg text-sm font-bold transition-all",
                  tab === 'outdoor' ? "bg-white dark:bg-slate-700 shadow-sm text-slate-900 dark:text-slate-100" : "text-slate-500 dark:text-slate-400"
                )}
              >
                Outdoor
              </button>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-3 gap-3 mb-6">
              <StatCard 
                label="PM2.5" 
                value={tab === 'indoor' ? (telemetry?.pm_1 || '0') : (telemetry?.pm_2 || '0')} 
                unit="µg/m³" 
                trend="down" 
                trendValue="2%" 
                trendType="positive" 
              />
              <StatCard 
                label="Temp" 
                value={telemetry?.cpu_temp_c || telemetry?.temperature || '22'} 
                unit="°C" 
                trend="up" 
                trendValue="1%" 
                trendType="negative" 
              />
              <StatCard 
                label="Humidity" 
                value={telemetry?.humidity || '45'} 
                unit="%" 
                trend="neutral" 
                trendValue="0%" 
                trendType="neutral" 
              />
            </div>

            {/* Chart Section */}
            <div className="mb-8">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h2 className="text-base font-bold">PM2.5 History ({tab === 'indoor' ? 'Indoor' : 'Outdoor'})</h2>
                  <p className="text-xs text-slate-500">Moving Average trend</p>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <div className="flex p-0.5 bg-slate-100 dark:bg-slate-800 rounded-lg">
                    {['1h', '6h', '24h', '7d'].map((d) => (
                      <button
                        key={d}
                        onClick={() => setDuration(d)}
                        className={cn(
                          "px-2 py-1 text-[10px] font-bold rounded-md transition-all",
                          duration === d ? "bg-white dark:bg-slate-700 shadow-sm text-primary" : "text-slate-400"
                        )}
                      >
                        {d}
                      </button>
                    ))}
                  </div>
                  <span className="text-[10px] font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-full uppercase">Good Quality</span>
                </div>
              </div>
              
              <div className="h-48 w-full bg-slate-50 dark:bg-slate-800/50 rounded-xl overflow-hidden border border-slate-100 dark:border-slate-700 p-2">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={tab === 'indoor' ? indoorHistory : outdoorHistory}>
                    <defs>
                      <linearGradient id="colorPm" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={tab === 'indoor' ? "#0f92f0" : "#94a3b8"} stopOpacity={0.3}/>
                        <stop offset="95%" stopColor={tab === 'indoor' ? "#0f92f0" : "#94a3b8"} stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <Area 
                      type="monotone" 
                      dataKey="pm25" 
                      stroke={tab === 'indoor' ? "#0f92f0" : "#94a3b8"} 
                      strokeWidth={3} 
                      fillOpacity={1} 
                      fill="url(#colorPm)" 
                      animationDuration={1000}
                    />
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                    <XAxis 
                      dataKey="time" 
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: 9, fill: '#94a3b8', fontWeight: 500 }}
                      minTickGap={20}
                      dy={10}
                    />
                    <YAxis 
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: 9, fill: '#94a3b8', fontWeight: 500 }}
                      width={20}
                    />
                    <Tooltip 
                      contentStyle={{ 
                        borderRadius: '12px', 
                        border: 'none', 
                        boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                        fontSize: '11px',
                        fontWeight: 'bold'
                      }}
                      itemStyle={{ color: tab === 'indoor' ? "#0f92f0" : "#64748b" }}
                      labelStyle={{ color: '#94a3b8', marginBottom: '4px' }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Comparison Section */}
            <div className="mb-8">
              <h2 className="text-base font-bold mb-4">Indoor vs Outdoor</h2>
              <div className="space-y-4 bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl border border-slate-100 dark:border-slate-700">
                <div>
                  <div className="flex justify-between text-xs font-bold mb-2">
                    <span className="flex items-center gap-1">
                      <span className="size-2 rounded-full bg-primary"></span> 
                      Indoor
                      <span className={cn(
                        "ml-1 px-1 rounded-[4px] text-[8px] uppercase",
                        telemetry?.pm_1_status?.toLowerCase().includes('ok') ? "bg-emerald-100 text-emerald-600" : "bg-rose-100 text-rose-600"
                      )}>
                        {telemetry?.pm_1_status}
                      </span>
                    </span>
                    <span>{telemetry?.pm_1 || '0'} µg/m³</span>
                  </div>
                  <div className="w-full bg-slate-200 dark:bg-slate-700 h-2.5 rounded-full overflow-hidden">
                    <div 
                      className="bg-primary h-full rounded-full transition-all duration-1000" 
                      style={{ width: `${Math.min(100, (parseInt(telemetry?.pm_1 || '0') / 50) * 100)}%` }}
                    ></div>
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-xs font-bold mb-2">
                    <span className="flex items-center gap-1">
                      <span className="size-2 rounded-full bg-slate-400"></span> 
                      Outdoor
                      <span className={cn(
                        "ml-1 px-1 rounded-[4px] text-[8px] uppercase",
                        telemetry?.pm_2_status?.toLowerCase().includes('ok') ? "bg-emerald-100 text-emerald-600" : "bg-rose-100 text-rose-600"
                      )}>
                        {telemetry?.pm_2_status}
                      </span>
                    </span>
                    <span>{telemetry?.pm_2 || '0'} µg/m³</span>
                  </div>
                  <div className="w-full bg-slate-200 dark:bg-slate-700 h-2.5 rounded-full overflow-hidden">
                    <div 
                      className="bg-slate-400 h-full rounded-full transition-all duration-1000" 
                      style={{ width: `${Math.min(100, (parseInt(telemetry?.pm_2 || '0') / 50) * 100)}%` }}
                    ></div>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-center gap-2 py-4 border-t border-slate-100 dark:border-slate-800">
              <Clock size={14} className="text-slate-400" />
              <p className="text-xs text-slate-400 font-medium tracking-wide">
                Updated {telemetry?.lastUpdate ? new Date(telemetry.lastUpdate).toLocaleTimeString() : 'just now'}
              </p>
            </div>
          </div>
        )}

        {screen === 'fans' && (
          <div className="p-4 space-y-6">
            {/* Device Info */}
            <div className="flex items-center justify-between bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-100 dark:border-slate-700 shadow-sm">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Connected Device</p>
                  <div className={cn(
                    "px-1.5 py-0.5 rounded-full text-[8px] font-bold uppercase tracking-tighter",
                    telemetry?.active ? "bg-emerald-100 text-emerald-600" : "bg-rose-100 text-rose-600"
                  )}>
                    {telemetry?.active ? 'Online' : 'Offline'}
                  </div>
                  {telemetry?.controller_state && telemetry.controller_state !== '-' && (
                    <div className="px-1.5 py-0.5 rounded-full text-[8px] font-bold uppercase tracking-tighter bg-primary/10 text-primary">
                      {telemetry.controller_state}
                    </div>
                  )}
                </div>
                <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">{telemetry?.deviceName || 'Loading...'}</h2>
              </div>
              <div className="size-10 bg-primary/10 rounded-full flex items-center justify-center text-primary">
                <Smartphone size={20} />
              </div>
            </div>

            {/* Control Airintake (2 CH) */}
            <section>
              <button 
                onClick={() => setExpandedAirintake(!expandedAirintake)}
                className="flex items-center justify-between w-full mb-4 group"
              >
                <h2 className="text-xl font-bold">Control Airintake (2 CH)</h2>
                <div className="size-8 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center text-slate-400 group-hover:text-primary transition-colors">
                  {expandedAirintake ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                </div>
              </button>
              
              <AnimatePresence>
                {expandedAirintake && (
                  <motion.div 
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.3, ease: 'easeInOut' }}
                    className="overflow-hidden"
                  >
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pb-2">
                      {[1, 2].map((fanId) => {
                        const mode = telemetry?.[`airintake_${fanId}_mode`] || '-';
                        const status = telemetry?.[`airintake_${fanId}_status`] || '-';
                        const rs485 = telemetry?.[`airintake_${fanId}_rs485`] || '-';
                        const isActive = status === 'ON';
                        const isRS485Disabled = rs485 === 'DISABLE';

                        return (
                          <Card key={fanId} className={cn("p-4 transition-opacity duration-300", isRS485Disabled && "opacity-80")}>
                            <div className="flex items-center gap-3 mb-4">
                              <div className={cn("p-2 rounded-lg", !isActive ? "bg-slate-100 text-slate-400" : "bg-primary/10 text-primary")}>
                                <Wind size={20} className={cn(isActive && "animate-pulse")} />
                              </div>
                              <h3 className="font-bold text-slate-900 dark:text-slate-100">Airintake {fanId}</h3>
                            </div>

                            <div className="grid grid-cols-3 gap-2 mb-4 bg-slate-50 dark:bg-slate-800/50 p-3 rounded-xl border border-slate-100 dark:border-slate-700">
                              <div className="text-center">
                                <p className="text-[10px] uppercase font-bold text-slate-400 mb-1">Mode</p>
                                <p className="text-xs font-bold text-blue-500">{mode}</p>
                              </div>
                              <div className="text-center">
                                <p className="text-[10px] uppercase font-bold text-slate-400 mb-1">Status</p>
                                <p className={cn("text-xs font-bold", isActive ? "text-green-500" : "text-slate-900 dark:text-white")}>{status}</p>
                              </div>
                              <div className="text-center">
                                <p className="text-[10px] uppercase font-bold text-slate-400 mb-1">RS485</p>
                                <p className={cn("text-xs font-bold", isRS485Disabled ? "text-rose-500" : "text-purple-500")}>{rs485}</p>
                              </div>
                            </div>

                            <div className={cn("space-y-3", isRS485Disabled && "pointer-events-none grayscale-[0.5]")}>
                              <div className="flex gap-2">
                                {['ON', 'AUTO', 'OFF'].map((m) => (
                                  <button
                                    key={m}
                                    disabled={isRS485Disabled}
                                    onClick={() => handleFanCommand('airintake_mode', fanId, m)}
                                    className={cn(
                                      "flex-1 py-2 text-[10px] font-bold rounded-lg border transition-all",
                                      mode === m 
                                        ? "bg-primary border-primary text-white shadow-sm" 
                                        : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-primary",
                                      isRS485Disabled && "opacity-50 cursor-not-allowed"
                                    )}
                                  >
                                    {m}
                                  </button>
                                ))}
                              </div>

                              <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
                                <button
                                  disabled={isRS485Disabled}
                                  onClick={() => handleFanCommand('airintake_addr', fanId)}
                                  className={cn(
                                    "w-full py-2 text-[10px] font-bold rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-primary hover:text-white transition-all",
                                    isRS485Disabled && "opacity-50 cursor-not-allowed"
                                  )}
                                >
                                  SET ADDR
                                </button>
                              </div>
                            </div>
                          </Card>
                        );
                      })}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </section>

            {/* Control Fan PM25 (3 CH) */}
            <section>
              <button 
                onClick={() => setExpandedFanPM25(!expandedFanPM25)}
                className="flex items-center justify-between w-full mb-4 group"
              >
                <h2 className="text-xl font-bold">Control Fan PM25 (3 CH)</h2>
                <div className="size-8 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center text-slate-400 group-hover:text-primary transition-colors">
                  {expandedFanPM25 ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                </div>
              </button>

              <AnimatePresence>
                {expandedFanPM25 && (
                  <motion.div 
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.3, ease: 'easeInOut' }}
                    className="overflow-hidden"
                  >
                    <div className="space-y-4 pb-2">
                      {[1, 2, 3].filter(id => id !== 3 || isTechAppUser).map((fanId) => {
                        const mode = telemetry?.[`fan_${fanId}_mode`] || '-';
                        const status = telemetry?.[`fan_${fanId}_status`] || '-';
                        const rpm = telemetry?.[`fan_${fanId}_rpm`] || '-';
                        const rs485 = telemetry?.[`fan_${fanId}_rs485`] || '-';
                        const isActive = status === 'ON';

                        return (
                          <Card key={fanId} className="p-4">
                            <div className="flex items-center gap-3 mb-4">
                              <div className={cn("p-2 rounded-lg", !isActive ? "bg-slate-100 text-slate-400" : "bg-primary/10 text-primary")}>
                                <Fan size={20} className={cn(isActive && "animate-spin-slow")} />
                              </div>
                              <h3 className="font-bold text-slate-900 dark:text-slate-100">Fan PM25 {fanId}</h3>
                            </div>

                            <div className="grid grid-cols-4 gap-2 mb-4 bg-slate-50 dark:bg-slate-800/50 p-3 rounded-xl border border-slate-100 dark:border-slate-700">
                              <div className="text-center">
                                <p className="text-[10px] uppercase font-bold text-slate-400 mb-1">Mode</p>
                                <p className="text-xs font-bold text-blue-500">{mode}</p>
                              </div>
                              <div className="text-center">
                                <p className="text-[10px] uppercase font-bold text-slate-400 mb-1">Status</p>
                                <p className={cn("text-xs font-bold", isActive ? "text-green-500" : "text-slate-900 dark:text-white")}>{status}</p>
                              </div>
                              <div className="text-center">
                                <p className="text-[10px] uppercase font-bold text-slate-400 mb-1">RPM</p>
                                <p className="text-xs font-bold text-slate-900 dark:text-white">{rpm}</p>
                              </div>
                              {isTechAppUser && (
                                <div className="text-center">
                                  <p className="text-[10px] uppercase font-bold text-slate-400 mb-1">RS485</p>
                                  <p className="text-xs font-bold text-purple-500">{rs485}</p>
                                </div>
                              )}
                            </div>

                            <div className="space-y-3">
                              <div className="flex gap-2">
                                {['ON', 'AUTO', 'OFF'].map((m) => (
                                  <button
                                    key={m}
                                    onClick={() => handleFanCommand('mode', fanId, m)}
                                    className={cn(
                                      "flex-1 py-2 text-[10px] font-bold rounded-lg border transition-all",
                                      mode === m 
                                        ? "bg-primary border-primary text-white shadow-sm" 
                                        : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-primary"
                                    )}
                                  >
                                    {m}
                                  </button>
                                ))}
                              </div>

                              {isTechAppUser && (
                                <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
                                  <p className="text-[10px] font-bold text-slate-400 uppercase mb-2">RS485 Controls</p>
                                  <div className="grid grid-cols-2 gap-2">
                                    <button
                                      onClick={() => handleFanCommand('addr', fanId)}
                                      className="py-2 text-[10px] font-bold rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-primary hover:text-white transition-all"
                                    >
                                      SET ADDR
                                    </button>
                                    {['LOW', 'MEDIUM', 'HIGH'].map((s) => (
                                      <button
                                        key={s}
                                        onClick={() => handleFanCommand('speed', fanId, s)}
                                        className="py-2 text-[10px] font-bold rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-primary hover:text-white transition-all"
                                      >
                                        {s}
                                      </button>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          </Card>
                        );
                      })}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </section>

            {/* Ventilation Fans */}
            <section>
              <button 
                onClick={() => setExpandedVentilation(!expandedVentilation)}
                className="flex items-center justify-between w-full mb-4 group"
              >
                <div className="flex items-center gap-2">
                  <h2 className="text-xl font-bold">Ventilation Fans (8)</h2>
                  <span className="px-2 py-1 bg-primary/10 text-primary text-[10px] font-bold rounded-full">ACTIVE</span>
                </div>
                <div className="size-8 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center text-slate-400 group-hover:text-primary transition-colors">
                  {expandedVentilation ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                </div>
              </button>

              <AnimatePresence>
                {expandedVentilation && (
                  <motion.div 
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.3, ease: 'easeInOut' }}
                    className="overflow-hidden"
                  >
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pb-2">
                      {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => {
                        const status = telemetry?.relays?.[i] || 'OFF';
                        const isActive = status === 'ON';
                        const isScheduled = status === 'SCHEDULE';
                        
                        return (
                          <Card key={i} className={cn("p-4", status === 'OFF' && "opacity-60")}>
                            <div className="flex justify-between items-start mb-4">
                              <div className="flex items-center gap-3">
                                <div className={cn("p-2 rounded-lg", status === 'OFF' ? "bg-slate-100 text-slate-400" : "bg-primary/10 text-primary")}>
                                  <Fan size={20} className={cn(isActive && "animate-spin-slow")} />
                                </div>
                                <div>
                                  <h3 className="font-bold text-slate-900 dark:text-white">Fan {i}</h3>
                                  <p className="text-[10px] text-slate-400 font-medium uppercase">Relay {i}</p>
                                </div>
                              </div>
                              <div className={cn(
                                "px-2 py-1 rounded-md text-[10px] font-bold",
                                isActive ? "bg-emerald-50 text-emerald-600" : 
                                isScheduled ? "bg-blue-50 text-blue-600" :
                                "bg-slate-100 text-slate-400"
                              )}>
                                {status}
                              </div>
                            </div>
                            
                            <div className="grid grid-cols-3 gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl">
                              {['ON', 'SCHEDULE', 'OFF'].map((m) => (
                                <button
                                  key={m}
                                  onClick={() => handleRelayMode(i, m)}
                                  className={cn(
                                    "py-2 text-[10px] font-bold rounded-lg transition-all",
                                    status === m 
                                      ? "bg-primary text-white shadow-sm" 
                                      : "text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700"
                                  )}
                                >
                                  {m}
                                </button>
                              ))}
                            </div>
                          </Card>
                        );
                      })}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </section>
          </div>
        )}

        {screen === 'settings' && (
          <div className="p-4 space-y-4">
            <section>
              <h2 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-3 ml-1">House Details</h2>
              <div className="space-y-2">
                <Card className="flex items-center justify-between py-3">
                  <span className="text-sm font-medium text-slate-600 dark:text-slate-400">ที่อยู่</span>
                  <span className="text-sm font-bold text-slate-900 dark:text-white">{selectedAsset?.address || '-'}</span>
                </Card>
                <Card className="flex items-center justify-between py-3">
                  <span className="text-sm font-medium text-slate-600 dark:text-slate-400">รหัสใบสั่งซื้อ</span>
                  <span className="text-sm font-bold text-slate-900 dark:text-white">{selectedAsset?.orderId || '-'}</span>
                </Card>
                <Card className="flex items-center justify-between py-3">
                  <span className="text-sm font-medium text-slate-600 dark:text-slate-400">project</span>
                  <span className="text-sm font-bold text-slate-900 dark:text-white">{selectedAsset?.project || '-'}</span>
                </Card>
                <Card className="flex items-center justify-between py-3">
                  <span className="text-sm font-medium text-slate-600 dark:text-slate-400">วันที่โอน</span>
                  <span className="text-sm font-bold text-slate-900 dark:text-white">{selectedAsset?.transferDate || '-'}</span>
                </Card>
              </div>
            </section>

            <section>
              <h2 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-3 ml-1">System Information</h2>
              <div className="space-y-2">
                <Card className="flex items-center justify-between py-3">
                  <span className="text-sm font-medium text-slate-600 dark:text-slate-400">Controller State</span>
                  <span className="text-sm font-bold text-slate-900 dark:text-white">{telemetry?.controller_state}</span>
                </Card>
                <Card className="flex items-center justify-between py-3">
                  <span className="text-sm font-medium text-slate-600 dark:text-slate-400">Board Detail</span>
                  <span className="text-sm font-bold text-slate-900 dark:text-white">{telemetry?.board_detail}</span>
                </Card>
                <Card className="flex items-center justify-between py-3">
                  <span className="text-sm font-medium text-slate-600 dark:text-slate-400">Board Type</span>
                  <span className="text-sm font-bold text-slate-900 dark:text-white">{telemetry?.board_type}</span>
                </Card>
                <Card className="flex items-center justify-between py-3">
                  <span className="text-sm font-medium text-slate-600 dark:text-slate-400">Firmware Version</span>
                  <span className="text-sm font-bold text-slate-900 dark:text-white">{telemetry?.firmware_version}</span>
                </Card>
              </div>
            </section>

            <section>
              <h2 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-3 ml-1">Connectivity & Status</h2>
              <div className="space-y-2">
                <Card className="flex items-center justify-between py-3">
                  <span className="text-sm font-medium text-slate-600 dark:text-slate-400">Device Status</span>
                  <div className="flex items-center gap-2">
                    <span className={cn(
                      "size-2 rounded-full animate-pulse",
                      telemetry?.active ? "bg-emerald-500" : "bg-rose-500"
                    )}></span>
                    <span className={cn(
                      "text-sm font-bold",
                      telemetry?.active ? "text-emerald-500" : "text-rose-500"
                    )}>{telemetry?.active ? 'Online' : 'Offline'}</span>
                  </div>
                </Card>
                <Card className="flex items-center justify-between py-3">
                  <span className="text-sm font-medium text-slate-600 dark:text-slate-400">RS485 Status</span>
                  <span className={cn(
                    "text-sm font-bold",
                    telemetry?.rs485_status?.toLowerCase().includes('ok') ? "text-emerald-500" : "text-rose-500"
                  )}>{telemetry?.rs485_status}</span>
                </Card>
                <Card className="flex items-center justify-between py-3">
                  <span className="text-sm font-medium text-slate-600 dark:text-slate-400">PM 2.5 Sensor Indoor</span>
                  <span className={cn(
                    "text-sm font-bold",
                    telemetry?.pm_1_status?.toLowerCase().includes('ok') ? "text-emerald-500" : "text-rose-500"
                  )}>{telemetry?.pm_1_status}</span>
                </Card>
                <Card className="flex items-center justify-between py-3">
                  <span className="text-sm font-medium text-slate-600 dark:text-slate-400">PM 2.5 Sensor Outdoor</span>
                  <span className={cn(
                    "text-sm font-bold",
                    telemetry?.pm_2_status?.toLowerCase().includes('ok') ? "text-emerald-500" : "text-rose-500"
                  )}>{telemetry?.pm_2_status}</span>
                </Card>
                <Card className="flex items-center justify-between py-3">
                  <span className="text-sm font-medium text-slate-600 dark:text-slate-400">Status</span>
                  <span className={cn(
                    "text-sm font-bold",
                    telemetry?.status?.toLowerCase().includes('online') ? "text-emerald-500" : "text-slate-900 dark:text-white"
                  )}>{telemetry?.status}</span>
                </Card>
                <Card className="flex items-center justify-between py-3">
                  <span className="text-sm font-medium text-slate-600 dark:text-slate-400">Uptime</span>
                  <span className="text-sm font-bold text-slate-900 dark:text-white">{formatUptime(telemetry?.uptime)}</span>
                </Card>
                <Card className="flex items-center justify-between py-3">
                  <span className="text-sm font-medium text-slate-600 dark:text-slate-400">Datetime</span>
                  <span className="text-sm font-bold text-slate-900 dark:text-white">{telemetry?.datetime}</span>
                </Card>
                <Card className="flex items-center justify-between py-3">
                  <span className="text-sm font-medium text-slate-600 dark:text-slate-400">Filter 1 Counter</span>
                  <span className="text-sm font-bold text-slate-900 dark:text-white">{telemetry?.filter_1_counter ?? 0} h</span>
                </Card>
                <Card className="flex items-center justify-between py-3">
                  <span className="text-sm font-medium text-slate-600 dark:text-slate-400">Filter 2 Counter</span>
                  <span className="text-sm font-bold text-slate-900 dark:text-white">{telemetry?.filter_2_counter ?? 0} h</span>
                </Card>
                <Card className="flex items-center justify-between py-3">
                  <span className="text-sm font-medium text-slate-600 dark:text-slate-400">PM 1 Moving Avg</span>
                  <span className="text-sm font-bold text-slate-900 dark:text-white">{telemetry?.pm_1_moving_avg ?? 'N/A'}</span>
                </Card>
                <Card className="flex items-center justify-between py-3">
                  <span className="text-sm font-medium text-slate-600 dark:text-slate-400">PM 2 Moving Avg</span>
                  <span className="text-sm font-bold text-slate-900 dark:text-white">{telemetry?.pm_2_moving_avg ?? 'N/A'}</span>
                </Card>
                <Card className="flex items-center justify-between py-3">
                  <span className="text-sm font-medium text-slate-600 dark:text-slate-400">CPU Temp</span>
                  <span className="text-sm font-bold text-slate-900 dark:text-white">{telemetry?.cpu_temp_c ?? 'N/A'} °C</span>
                </Card>
                <Card className="flex items-center justify-between py-3">
                  <span className="text-sm font-medium text-slate-600 dark:text-slate-400">OTA Status</span>
                  <span className="text-sm font-bold text-blue-500">{telemetry?.OTAStatus ?? 'Idle'}</span>
                </Card>
                <Card className="flex items-center justify-between py-3">
                  <span className="text-sm font-medium text-slate-600 dark:text-slate-400">OTA Progress</span>
                  <span className="text-sm font-bold text-blue-500">{telemetry?.OTAProgress ?? 0}%</span>
                </Card>
              </div>
            </section>

            {isTechAppUser && (
              <section>
                <h2 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-3 ml-1">Device Controls</h2>
                <div className="grid grid-cols-2 gap-3">
                  <button 
                    onClick={handleReboot}
                    disabled={loading}
                    className="flex flex-col items-center justify-center p-4 bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl shadow-sm hover:border-primary transition-all gap-2"
                  >
                    <div className="size-10 bg-amber-50 dark:bg-amber-900/20 rounded-xl flex items-center justify-center text-amber-500">
                      <RotateCcw size={20} />
                    </div>
                    <span className="text-xs font-bold text-slate-900 dark:text-white">Reboot</span>
                  </button>
                  <button 
                    onClick={handleOTAUpdate}
                    disabled={loading}
                    className="flex flex-col items-center justify-center p-4 bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl shadow-sm hover:border-primary transition-all gap-2"
                  >
                    <div className="size-10 bg-blue-50 dark:bg-blue-900/20 rounded-xl flex items-center justify-center text-blue-500">
                      <DownloadCloud size={20} />
                    </div>
                    <span className="text-xs font-bold text-slate-900 dark:text-white">OTA Update</span>
                  </button>
                </div>
              </section>
            )}

            <section>
              <h2 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-3 ml-1">Account</h2>
              <Card className="flex items-center justify-between py-3">
                <span className="text-sm font-medium text-slate-600 dark:text-slate-400">Logged in as</span>
                <span className="text-sm font-bold text-slate-900 dark:text-white">{username}</span>
              </Card>
              <button 
                onClick={() => setScreen('login')}
                className="w-full mt-4 py-4 bg-rose-50 dark:bg-rose-900/20 text-rose-500 font-bold rounded-2xl hover:bg-rose-100 dark:hover:bg-rose-900/30 transition-all"
              >
                Sign Out
              </button>
            </section>
          </div>
        )}
      </main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 w-full max-w-md bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800 pb-6 pt-2 px-4 flex justify-between items-center z-20">
        <button 
          onClick={() => setScreen('assets')}
          className="flex flex-col items-center gap-1 text-slate-400 dark:text-slate-500"
        >
          <Home size={24} />
          <span className="text-[10px] font-bold uppercase tracking-wider">Home</span>
        </button>
        <button 
          onClick={() => setScreen('stats')}
          className={cn("flex flex-col items-center gap-1", screen === 'stats' ? "text-primary" : "text-slate-400")}
        >
          <BarChart3 size={24} />
          <span className="text-[10px] font-bold uppercase tracking-wider">Stats</span>
        </button>
        <button 
          onClick={() => setScreen('fans')}
          className={cn("flex flex-col items-center gap-1", screen === 'fans' ? "text-primary" : "text-slate-400")}
        >
          <Smartphone size={24} />
          <span className="text-[10px] font-bold uppercase tracking-wider">Devices</span>
        </button>
        <button 
          onClick={() => setScreen('settings')}
          className={cn("flex flex-col items-center gap-1", screen === 'settings' ? "text-primary" : "text-slate-400 dark:text-slate-500")}
        >
          <Settings size={24} />
          <span className="text-[10px] font-bold uppercase tracking-wider">Settings</span>
        </button>
      </nav>

      <style>{`
        .animate-spin-slow {
          animation: spin 3s linear infinite;
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
