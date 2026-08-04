import { useState } from 'react';
import { Button, Input } from './ui';
import { apiService, type KvkRegistrationLookup } from '../services/api';

type KvkLookupControlProps = {
  value: string;
  onChange: (value: string) => void;
  onResult: (result: KvkRegistrationLookup, normalizedKvk: string) => void;
  placeholder: string;
  findLabel: string;
  searchingLabel: string;
  invalidMessage: string;
  sourceMessages: Record<KvkRegistrationLookup['source'], string>;
  disabled?: boolean;
  className?: string;
};

export const KvkLookupControl = ({
  value,
  onChange,
  onResult,
  placeholder,
  findLabel,
  searchingLabel,
  invalidMessage,
  sourceMessages,
  disabled = false,
  className = '',
}: KvkLookupControlProps) => {
  const [isLookingUp, setIsLookingUp] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [source, setSource] = useState<KvkRegistrationLookup['source'] | null>(null);
  const normalizedKvk = value.replace(/[\s.\-\/()]+/g, '');
  const isValid = /^\d{8}$/.test(normalizedKvk);

  const lookup = async () => {
    if (!isValid || isLookingUp) {
      setError(invalidMessage);
      return;
    }

    setIsLookingUp(true);
    setError(null);
    setSource(null);
    try {
      const result = await apiService.auth.kvkLookup(normalizedKvk);
      onResult(result, normalizedKvk);
      setSource(result.source);
    } catch (lookupError) {
      setError(lookupError instanceof Error ? lookupError.message : invalidMessage);
    } finally {
      setIsLookingUp(false);
    }
  };

  return (
    <div className={className}>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Input
          required
          inputMode="numeric"
          placeholder={placeholder}
          value={value}
          onChange={(event) => {
            onChange(event.target.value);
            setError(null);
            setSource(null);
          }}
        />
        <Button type="button" className="w-full sm:w-auto" onClick={() => void lookup()} disabled={disabled || isLookingUp || !isValid}>
          {isLookingUp ? searchingLabel : findLabel}
        </Button>
      </div>
      {source && <p className="mt-2 rounded-xl bg-emerald-50 p-3 text-xs font-semibold text-emerald-800 dark:bg-emerald-400/10 dark:text-emerald-100">{sourceMessages[source]}</p>}
      {error && <p className="mt-2 rounded-xl bg-rose-50 p-3 text-xs font-semibold text-rose-700 dark:bg-rose-400/10 dark:text-rose-100">{error}</p>}
    </div>
  );
};
