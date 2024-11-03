'use client';

import { NetworkAndGas } from '@/components/NetworkAndGas';
import { useUtxoContext } from '@/contexts/chains/utxo/UtxoContext';
import { useGas } from '@/hooks/chains/utxo/useGas';

export function UTXONetworkAndGas() {
  const { 
    network, setNetwork,
    gasLevel, setGasLevel,
    customGas, setCustomGas
  } = useUtxoContext();
  const { gasInfo, countdown, loading } = useGas();

  return (
    <NetworkAndGas
      networks={[
        { value: 'btc', label: 'Bitcoin' },
        { value: 'fractal', label: 'Fractal' }
      ]}
      selectedNetwork={network}
      onNetworkChange={setNetwork}
      gasInfo={gasInfo}
      gasLevel={gasLevel}
      onGasLevelChange={setGasLevel}
      customGas={customGas}
      onCustomGasChange={setCustomGas}
      countdown={countdown}
      loading={loading}
      gasUnit="sat/vB"
    />
  );
} 