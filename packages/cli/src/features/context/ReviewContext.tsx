import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';

/**
 * Review status
 */
export type ReviewStatus = 'pending' | 'approved' | 'rejected';

/**
 * Diff review
 */
export interface Review {
  id: string;
  file: string;
  diff: string;
  linesAdded: number;
  linesRemoved: number;
  status: ReviewStatus;
  timestamp: Date;
}

/**
 * Review context value
 */
export interface ReviewContextValue {
  /** All reviews */
  reviews: Review[];
  
  /** Number of pending reviews */
  pendingCount: number;
  
  /** Approve a review */
  approve: (id: string) => Promise<void>;
  
  /** Reject a review */
  reject: (id: string) => Promise<void>;
  
  /** Approve all pending reviews */
  approveAll: () => Promise<void>;
  
  /** Reject all pending reviews */
  rejectAll: () => Promise<void>;
  
  /** Add a new review */
  addReview: (review: Omit<Review, 'id' | 'status' | 'timestamp'>) => void;
  
  /** Get pending reviews */
  getPendingReviews: () => Review[];
}

const ReviewContext = createContext<ReviewContextValue | undefined>(undefined);

export interface ReviewProviderProps {
  children: ReactNode;
  
  /** Initial reviews */
  initialReviews?: Review[];
  
  /** Callback when a review is approved */
  onApprove?: (review: Review) => Promise<void>;
  
  /** Callback when a review is rejected */
  onReject?: (review: Review) => Promise<void>;
}

export function ReviewProvider({
  children,
  initialReviews = [],
  onApprove,
  onReject,
}: ReviewProviderProps) {
  const [reviews, setReviews] = useState<Review[]>(initialReviews);

  const addReview = useCallback((review: Omit<Review, 'id' | 'status' | 'timestamp'>) => {
    const newReview: Review = {
      ...review,
      id: `review-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      status: 'pending',
      timestamp: new Date(),
    };
    setReviews((prev) => [...prev, newReview]);
  }, []);

  const approve = useCallback(
    async (id: string) => {
      const review = reviews.find((r) => r.id === id);
      if (!review) {
        throw new Error(`Review not found: ${id}`);
      }

      try {
        // Call external handler if provided
        if (onApprove) {
          await onApprove(review);
        }

        // Update status and remove from list
        setReviews((prev) => prev.filter((r) => r.id !== id));
      } catch (error) {
        console.error('Error approving review:', error);
        throw error;
      }
    },
    [reviews, onApprove]
  );

  const reject = useCallback(
    async (id: string) => {
      const review = reviews.find((r) => r.id === id);
      if (!review) {
        throw new Error(`Review not found: ${id}`);
      }

      try {
        // Call external handler if provided
        if (onReject) {
          await onReject(review);
        }

        // Update status and remove from list
        setReviews((prev) => prev.filter((r) => r.id !== id));
      } catch (error) {
        console.error('Error rejecting review:', error);
        throw error;
      }
    },
    [reviews, onReject]
  );

  const approveAll = useCallback(async () => {
    const pending = reviews.filter((r) => r.status === 'pending');
    
    try {
      // Approve all pending reviews
      for (const review of pending) {
        if (onApprove) {
          await onApprove(review);
        }
      }

      // Remove all pending reviews
      setReviews((prev) => prev.filter((r) => r.status !== 'pending'));
    } catch (error) {
      console.error('Error approving all reviews:', error);
      throw error;
    }
  }, [reviews, onApprove]);

  const rejectAll = useCallback(async () => {
    const pending = reviews.filter((r) => r.status === 'pending');
    
    try {
      // Reject all pending reviews
      for (const review of pending) {
        if (onReject) {
          await onReject(review);
        }
      }

      // Remove all pending reviews
      setReviews((prev) => prev.filter((r) => r.status !== 'pending'));
    } catch (error) {
      console.error('Error rejecting all reviews:', error);
      throw error;
    }
  }, [reviews, onReject]);

  const getPendingReviews = useCallback(() => {
    return reviews.filter((r) => r.status === 'pending');
  }, [reviews]);

  const pendingCount = reviews.filter((r) => r.status === 'pending').length;

  const value: ReviewContextValue = {
    reviews,
    pendingCount,
    approve,
    reject,
    approveAll,
    rejectAll,
    addReview,
    getPendingReviews,
  };

  return <ReviewContext.Provider value={value}>{children}</ReviewContext.Provider>;
}

export function useReview(): ReviewContextValue {
  const context = useContext(ReviewContext);
  if (!context) {
    throw new Error('useReview must be used within a ReviewProvider');
  }
  return context;
}
