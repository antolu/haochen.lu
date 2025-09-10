import React from 'react';
import { Link } from 'react-router-dom';
import PhotoGrid from '../components/PhotoGrid';
import PhotoLightbox from '../components/PhotoLightbox';
import { useInfinitePhotos } from '../hooks/usePhotos';
import type { Photo } from '../types';

const AlbumPage: React.FC = () => {
  // Use infinite scroll for better performance with large photo collections
  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading, isError } =
    useInfinitePhotos({
      order_by: 'date_taken',
    });

  // Flatten all pages into a single array
  const photos = React.useMemo(() => {
    return data?.pages.flatMap(page => page.photos) || [];
  }, [data]);

  const handlePhotoClick = (_photo: Photo, _index: number) => {
    // The PhotoLightbox will handle the modal automatically
  };

  React.useEffect(() => {
    const handleScroll = () => {
      if (
        window.innerHeight + window.scrollY >= document.body.offsetHeight - 1000 &&
        hasNextPage &&
        !isFetchingNextPage
      ) {
        fetchNextPage();
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [fetchNextPage, hasNextPage, isFetchingNextPage]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black">
        <div className="text-center text-white">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
          <p className="text-lg">Loading photos...</p>
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black">
        <div className="text-center text-white">
          <svg
            className="h-12 w-12 mx-auto mb-4 text-red-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"
            />
          </svg>
          <p className="text-lg mb-4">Failed to load photos</p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-white text-black rounded-lg hover:bg-gray-200 transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black w-full m-0 p-0">
      {/* Minimal Navigation Header */}
      <header className="fixed top-0 left-0 right-0 z-40 bg-black/80 backdrop-blur-sm">
        <div className="flex items-center justify-between p-4">
          <Link
            to="/"
            className="flex items-center space-x-2 text-white hover:text-gray-300 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M15 19l-7-7 7-7"
              />
            </svg>
            <span className="text-sm font-medium">Back to Home</span>
          </Link>
          <div className="text-white text-sm font-light">
            {photos.length > 0 ? `${photos.length} Photos` : 'Album'}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="pt-16 px-4">
        {photos.length === 0 ? (
          <div className="flex items-center justify-center min-h-[60vh]">
            <div className="text-center text-white">
              <svg
                className="h-16 w-16 mx-auto mb-4 text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                />
              </svg>
              <h2 className="text-2xl font-bold mb-2">No Photos Yet</h2>
              <p className="text-gray-400 mb-4">Upload some photos to see them in your album</p>
            </div>
          </div>
        ) : (
          <PhotoLightbox photos={photos}>
            <div className="max-w-7xl mx-auto">
              <PhotoGrid
                photos={photos}
                isLoading={false}
                onPhotoClick={handlePhotoClick}
                showMetadata={false}
                columns={5}
                gap={2}
                className="min-h-screen"
              />
            </div>
          </PhotoLightbox>
        )}

        {/* Loading indicator for infinite scroll */}
        {isFetchingNextPage && (
          <div className="flex justify-center py-8">
            <div className="text-center text-white">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto mb-2"></div>
              <p className="text-sm">Loading more photos...</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AlbumPage;
