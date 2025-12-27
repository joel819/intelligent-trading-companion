import { useTradingContext } from '@/context/TradingContext';

export const useTradingData = () => {
    return useTradingContext();
};
