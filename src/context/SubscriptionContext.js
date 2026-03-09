import React, { createContext, useState, useEffect, useContext } from 'react';
import api from '../utils/api';
import Toast from 'react-native-toast-message';

const SubscriptionContext = createContext();

export const SubscriptionProvider = ({ children }) => {
  const [subscription, setSubscription] = useState(null);
  const [usage, setUsage] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchSubscription = async () => {
    try {
      const response = await api.get('/subscription/get-active-subscriptions');
      if (response.success) {
        // console.log(response);
        setSubscription(response.data.subscription);
        // console.log(subscription);
        setUsage(response.data.usage);
        // console.log("subcription data: ", response.data)
      } else {
        setSubscription(null);
        setUsage(null);
      }
    } catch (err) {
      console.error('Error fetching subscription:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSubscription();
  }, []);

  // ✅ Helper to check if user can create invoice
  const canCreateInvoice = () => {
    // if (!subscription) {
    //   return {
    //     allowed: false,
    //     reason: 'no-subscription',
    //     message: 'No active subscription found. Please subscribe to a plan.',
    //   };
    // }

    // Check expiry
    const now = new Date();
    const endDate = new Date(subscription.endDate);
    if (now > endDate) {
      return {
        allowed: false,
        reason: 'expired',
        message: 'Your subscription has expired. Please renew your plan.',
      };
    }

    // Check usage limit
    if (usage && subscription.usageLimits?.invoices !== undefined) {
      if (usage.invoicesUsed >= subscription.usageLimits.invoices) {
        return {
          allowed: false,
          reason: 'limit',
          message:
            'You have reached your invoice limit. Please upgrade your plan.',
        };
      }
    }

    return { allowed: true };
  };

  return (
    <SubscriptionContext.Provider
      value={{
        subscription,
        usage,
        loading,
        canCreateInvoice,
        fetchSubscription,
      }}
    >
      {children}
    </SubscriptionContext.Provider>
  );
};

// Custom hook for easy access
export const useSubscription = () => useContext(SubscriptionContext);
