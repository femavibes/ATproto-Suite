/**
 * Node Handlers
 * Handles node configuration and modal state management
 * Extracted from Canvas.jsx to reduce file size
 */

export const createNodeHandlers = (setModalState) => {
  return {
    createTextHandler: (node) => ({
      ...node,
      data: {
        ...node.data,
        onConfigure: () => {
          setModalState({
            isOpen: true,
            modalType: 'keyword',
            nodeId: node.id,
            keywords: node.data?.keywords || [],
            name: node.data?.name || '',
            fields: node.data?.fields || ['text'],
            exclude: node.data?.exclude || false,
          })
        },
      },
    }),

    createRegexHandler: (node) => ({
      ...node,
      data: {
        ...node.data,
        onConfigure: () => {
          setModalState({
            isOpen: true,
            modalType: 'regex',
            nodeId: node.id,
            pattern: node.data?.pattern || '',
            name: node.data?.name || '',
            fields: node.data?.fields || ['text'],
            exclude: node.data?.exclude || false,
            flags: node.data?.flags || '',
          })
        },
      },
    }),

    createLanguageHandler: (node) => ({
      ...node,
      data: {
        ...node.data,
        onConfigure: () => {
          setModalState({
            isOpen: true,
            modalType: 'language',
            nodeId: node.id,
            languages: node.data?.languages || [],
            name: node.data?.name || '',
            exclude: node.data?.exclude || false,
          })
        },
      },
    }),

    createPostTypeHandler: (node) => ({
      ...node,
      data: {
        ...node.data,
        onConfigure: () => {
          setModalState({
            isOpen: true,
            modalType: 'posttype',
            nodeId: node.id,
            types: node.data?.types || [],
            name: node.data?.name || '',
            exclude: node.data?.exclude || false,
            replyDepthEnabled: node.data?.replyDepthEnabled || false,
            replyDepthOperator: node.data?.replyDepthOperator || 'equals',
            replyDepth: node.data?.replyDepth || 1,
            postTypeScores: node.data?.postTypeScores,
          })
        },
      },
    }),

    createAuthorHandler: (node) => ({
      ...node,
      data: {
        ...node.data,
        onConfigure: () => {
          setModalState({
            isOpen: true,
            modalType: 'author',
            nodeId: node.id,
            authors: node.data?.authors || [],
            listUris: node.data?.listUris || [],
            name: node.data?.name || '',
            exclude: node.data?.exclude || false,
          })
        },
      },
    }),

    createMediaHandler: (node) => ({
      ...node,
      data: {
        ...node.data,
        onConfigure: () => {
          setModalState({
            isOpen: true,
            modalType: 'media',
            nodeId: node.id,
            types: node.data?.types || [],
            name: node.data?.name || '',
            exclude: node.data?.exclude || false,
            mediaTypeScores: node.data?.mediaTypeScores,
          })
        },
      },
    }),

    createHashtagHandler: (node) => ({
      ...node,
      data: {
        ...node.data,
        onConfigure: () => {
          setModalState({
            isOpen: true,
            modalType: 'hashtag',
            nodeId: node.id,
            tags: node.data?.tags || [],
            fieldTypes: node.data?.fieldTypes || ['outline_tags', 'hashtags'],
            name: node.data?.name || '',
            exclude: node.data?.exclude || false,
          })
        },
      },
    }),

    createLabelsHandler: (node) => ({
      ...node,
      data: {
        ...node.data,
        onConfigure: () => {
          setModalState({
            isOpen: true,
            modalType: 'labels',
            nodeId: node.id,
            labels: node.data?.labels || [],
            name: node.data?.name || '',
            exclude: node.data?.exclude || false,
          })
        },
      },
    }),

    createDateAgeHandler: (node) => ({
      ...node,
      data: {
        ...node.data,
        onConfigure: () => {
          setModalState({
            isOpen: true,
            modalType: 'dateage',
            nodeId: node.id,
            mode: node.data?.mode || 'newer_than',
            value: node.data?.value || { amount: 24, unit: 'hours' },
            name: node.data?.name || '',
            exclude: node.data?.exclude || false,
          })
        },
      },
    }),

    createNOfHandler: (node) => ({
      ...node,
      data: {
        ...node.data,
        onConfigure: () => {
          setModalState({
            isOpen: true,
            modalType: 'nof',
            nodeId: node.id,
            n: node.data?.n || 2,
          })
        },
      },
    }),

    createManualPostsHandler: (node) => ({
      ...node,
      data: {
        ...node.data,
        onConfigure: () => {
          setModalState({
            isOpen: true,
            modalType: 'manualposts',
            nodeId: node.id,
            posts: node.data?.posts || [],
            name: node.data?.name || '',
          })
        },
      },
    }),

    createEngagementHandler: (node) => ({
      ...node,
      data: {
        ...node.data,
        onConfigure: () => {
          setModalState({
            isOpen: true,
            modalType: 'engagement',
            nodeId: node.id,
            metricType: node.data?.metricType || 'likes',
            operator: node.data?.operator || 'greater_than',
            threshold: node.data?.threshold || 0,
          })
        },
      },
    }),

    createPostStructureHandler: (node) => ({
      ...node,
      data: {
        ...node.data,
        onConfigure: () => {
          setModalState({
            isOpen: true,
            modalType: 'poststructure',
            nodeId: node.id,
            structureType: node.data?.structureType || 'is_reply',
            operator: node.data?.operator || 'equals',
            depth: node.data?.depth || 1,
          })
        },
      },
    }),

    createMentionsHandler: (node) => ({
      ...node,
      data: {
        ...node.data,
        onConfigure: () => {
          setModalState({
            isOpen: true,
            modalType: 'mentions',
            nodeId: node.id,
            mentions: node.data?.mentions || [],
            listUris: node.data?.listUris || [],
            name: node.data?.name || '',
            exclude: node.data?.exclude || false,
          })
        },
      },
    }),

    createLinksHandler: (node) => ({
      ...node,
      data: {
        ...node.data,
        onConfigure: () => {
          setModalState({
            isOpen: true,
            modalType: 'links',
            nodeId: node.id,
            urls: node.data?.urls || [],
            name: node.data?.name || '',
            exclude: node.data?.exclude || false,
            requireThumbnail: node.data?.requireThumbnail || false,
          })
        },
      },
    }),

    createQuotePostHandler: (node) => ({
      ...node,
      data: {
        ...node.data,
        onConfigure: () => {
          setModalState({
            isOpen: true,
            modalType: 'quotepost',
            nodeId: node.id,
            uris: node.data?.uris || [],
            dids: node.data?.dids || [],
            name: node.data?.name || '',
            exclude: node.data?.exclude || false,
          })
        },
      },
    }),

    createImageHandler: (node) => ({
      ...node,
      data: {
        ...node.data,
        onConfigure: () => {
          setModalState({
            isOpen: true,
            modalType: 'image',
            nodeId: node.id,
            imageCount: node.data?.imageCount ?? null,
            minWidth: node.data?.minWidth ?? null,
            maxWidth: node.data?.maxWidth ?? null,
            minHeight: node.data?.minHeight ?? null,
            maxHeight: node.data?.maxHeight ?? null,
            aspectRatio: node.data?.aspectRatio ?? null,
            minFileSize: node.data?.minFileSize ?? null,
            maxFileSize: node.data?.maxFileSize ?? null,
            exclude: node.data?.exclude || false,
          })
        },
      },
    }),

    createVideoHandler: (node) => ({
      ...node,
      data: {
        ...node.data,
        onConfigure: () => {
          setModalState({
            isOpen: true,
            modalType: 'video',
            nodeId: node.id,
            minWidth: node.data?.minWidth ?? null,
            maxWidth: node.data?.maxWidth ?? null,
            minHeight: node.data?.minHeight ?? null,
            maxHeight: node.data?.maxHeight ?? null,
            aspectRatio: node.data?.aspectRatio ?? null,
            minFileSize: node.data?.minFileSize ?? null,
            maxFileSize: node.data?.maxFileSize ?? null,
            presentation: node.data?.presentation ?? null,
            exclude: node.data?.exclude || false,
          })
        },
      },
    }),

    createRecencyHandler: (node) => ({
      ...node,
      data: {
        ...node.data,
        onConfigure: () => {
          setModalState({
            isOpen: true,
            modalType: 'recency',
            nodeId: node.id,
            decayHours: node.data?.decayHours ?? 24,
            maxBoost: node.data?.maxBoost ?? 100,
          })
        },
      },
    }),

    createEngagementScoreHandler: (node) => ({
      ...node,
      data: {
        ...node.data,
        onConfigure: () => {
          setModalState({
            isOpen: true,
            modalType: 'engagementscore',
            nodeId: node.id,
            likeWeight: node.data?.likeWeight ?? 1,
            replyWeight: node.data?.replyWeight ?? 2,
            repostWeight: node.data?.repostWeight ?? 3,
            quoteWeight: node.data?.quoteWeight ?? 4,
            bookmarkWeight: node.data?.bookmarkWeight ?? 1,
          })
        },
      },
    }),

    createCustomScoreHandler: (node) => ({
      ...node,
      data: {
        ...node.data,
        onConfigure: () => {
          setModalState({
            isOpen: true,
            modalType: 'customscore',
            nodeId: node.id,
            score: node.data?.score ?? 0,
          })
        },
      },
    }),

    createRotatingPostsHandler: (node) => ({
      ...node,
      data: {
        ...node.data,
        onConfigure: () => {
          setModalState({
            isOpen: true,
            modalType: 'rotatingposts',
            nodeId: node.id,
            postUrls: node.data?.postUrls || [],
            strategy: node.data?.strategy || 'round-robin',
          })
        },
      },
    }),

    createFeedAdsHandler: (node) => ({
      ...node,
      data: {
        ...node.data,
        onConfigure: () => {
          setModalState({
            isOpen: true,
            modalType: 'feedads',
            nodeId: node.id,
            postUrls: node.data?.postUrls || [],
            strategy: node.data?.strategy || 'round-robin',
          })
        },
      },
    }),

    createChronologicalHandler: (node) => ({
      ...node,
      data: {
        ...node.data,
        onConfigure: () => {
          setModalState({
            isOpen: true,
            modalType: 'chronological',
            nodeId: node.id,
            order: node.data?.order || 'newest',
          })
        },
      },
    }),

    createByScoreHandler: (node) => ({
      ...node,
      data: {
        ...node.data,
        onConfigure: () => {
          // By Score has no configuration needed
          setModalState({
            isOpen: false,
            modalType: 'byscore',
            nodeId: node.id,
          })
        },
      },
    }),

    createMostLikesHandler: (node) => ({
      ...node,
      data: {
        ...node.data,
        onConfigure: () => {
          // Most Likes has no configuration needed
          setModalState({
            isOpen: false,
            modalType: 'mostlikes',
            nodeId: node.id,
          })
        },
      },
    }),

    createMostEngagementHandler: (node) => ({
      ...node,
      data: {
        ...node.data,
        onConfigure: () => {
          // Most Engagement has no configuration needed
          setModalState({
            isOpen: false,
            modalType: 'mostengagement',
            nodeId: node.id,
          })
        },
      },
    }),

    createRandomHandler: (node) => ({
      ...node,
      data: {
        ...node.data,
        onConfigure: () => {
          // Random has no configuration needed
          setModalState({
            isOpen: false,
            modalType: 'random',
            nodeId: node.id,
          })
        },
      },
    }),

    createDynamicPinnedHandler: (node) => ({
      ...node,
      data: {
        ...node.data,
        onConfigure: () => {
          setModalState({
            isOpen: true,
            modalType: 'dynamicpinned',
            nodeId: node.id,
            position: node.data?.position || 0,
            apiEndpoint: node.data?.apiEndpoint || '',
            name: node.data?.name || '',
          })
        },
      },
    }),

    createPinnedPostsHandler: (node) => ({
      ...node,
      data: {
        ...node.data,
        onConfigure: () => {
          setModalState({
            isOpen: true,
            modalType: 'pinnedposts',
            nodeId: node.id,
            items: Array.isArray(node.data?.items) ? node.data.items : [],
            name: node.data?.name || '',
          })
        },
      },
    }),

    createFeaturedPostHandler: (node) => ({
      ...node,
      data: {
        ...node.data,
        onConfigure: () => {
          setModalState({
            isOpen: true,
            modalType: 'featuredpost',
            nodeId: node.id,
            position: node.data?.position || 1,
            apiEndpoint: node.data?.apiEndpoint || '',
            name: node.data?.name || '',
          })
        },
      },
    }),

    createFixedChronologicalHandler: (node) => ({
      ...node,
      data: {
        ...node.data,
        onConfigure: () => {
          setModalState({
            isOpen: true,
            modalType: 'fixedchronological',
            nodeId: node.id,
            startPosition: node.data?.startPosition,
            endPosition: node.data?.endPosition,
            order: node.data?.order || 'newest',
            name: node.data?.name || '',
          })
        },
      },
    }),

    createFixedByScoreHandler: (node) => ({
      ...node,
      data: {
        ...node.data,
        onConfigure: () => {
          setModalState({
            isOpen: true,
            modalType: 'fixedbyscore',
            nodeId: node.id,
            startPosition: node.data?.startPosition,
            endPosition: node.data?.endPosition,
            name: node.data?.name || '',
          })
        },
      },
    }),

    createFixedMostLikesHandler: (node) => ({
      ...node,
      data: {
        ...node.data,
        onConfigure: () => {
          setModalState({
            isOpen: true,
            modalType: 'fixedmostlikes',
            nodeId: node.id,
            startPosition: node.data?.startPosition,
            endPosition: node.data?.endPosition,
            name: node.data?.name || '',
          })
        },
      },
    }),

    createFixedMostEngagementHandler: (node) => ({
      ...node,
      data: {
        ...node.data,
        onConfigure: () => {
          setModalState({
            isOpen: true,
            modalType: 'fixedmostengagement',
            nodeId: node.id,
            startPosition: node.data?.startPosition,
            endPosition: node.data?.endPosition,
            name: node.data?.name || '',
          })
        },
      },
    }),

    createFixedRandomHandler: (node) => ({
      ...node,
      data: {
        ...node.data,
        onConfigure: () => {
          setModalState({
            isOpen: true,
            modalType: 'fixedrandom',
            nodeId: node.id,
            startPosition: node.data?.startPosition,
            endPosition: node.data?.endPosition,
            name: node.data?.name || '',
          })
        },
      },
    }),
  }
}
