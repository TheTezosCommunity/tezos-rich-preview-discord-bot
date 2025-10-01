export interface TezosNFT {
    id: string;
    name: string;
    description?: string | undefined;
    imageUrl?: string | undefined;
    creator: {
        address: string;
        alias?: string | undefined;
        discord?: string | undefined;
        twitter?: string | undefined;
        website?: string | undefined;
        description?: string | undefined;
    };
    collection?:
        | {
              name: string;
              slug?: string | undefined;
              description?: string | undefined;
              logo?: string | undefined;
              collectionType?: string | undefined;
              floorPrice?: number | undefined;
              items?: number | undefined;
              editions?: number | undefined;
              owners?: number | undefined;
              twitter?: string | undefined;
              website?: string | undefined;
              volume24h?: number | undefined;
              volumeTotal?: number | undefined;
              verifiedCreators?: string[] | undefined;
          }
        | undefined;
    price?:
        | {
              amount: number;
              currency: string;
              symbol: string;
          }
        | undefined;
    saleType?: "open_edition" | "listing" | "dutch_auction" | "english_auction" | "none" | undefined;
    openEditionInfo?:
        | {
              maxPerWallet?: number;
              endTime?: string;
              startTime?: string;
              mintedCount?: number;
          }
        | undefined;
    edition?:
        | {
              current: number;
              total: number;
          }
        | undefined;
    marketplace: {
        name: string;
        url: string;
    };
    attributes?:
        | Array<{
              trait_type: string;
              value: string | number;
          }>
        | undefined;
    metadata?:
        | {
              mimeType?: string | undefined;
              artifactUri?: string | undefined;
              displayUri?: string | undefined;
              thumbnailUri?: string | undefined;
          }
        | undefined;
}

export interface MarketplaceMatch {
    marketplace: string;
    tokenId: string;
    contractAddress?: string | undefined;
    url: string;
}

export interface TzktToken {
    id: number;
    account: {
        address: string;
        alias?: string;
    };
    token: {
        id: number;
        contract: {
            address: string;
            alias?: string;
        };
        tokenId: string;
        standard: string;
        metadata?: {
            name?: string;
            description?: string;
            image?: string;
            displayUri?: string;
            thumbnailUri?: string;
            artifactUri?: string;
            attributes?: Array<{
                name: string;
                value: string | number;
            }>;
        };
    };
    balance: string;
    transfersCount: number;
    firstLevel: number;
    firstTime: string;
    lastLevel: number;
    lastTime: string;
}

export interface ObjktListing {
    id: number;
    price: string;
    currency_id: number;
    seller_address: string;
    token: {
        token_id: string;
        fa2_address: string;
        name: string;
        description?: string;
        mime_type?: string;
        artifact_uri?: string;
        display_uri?: string;
        thumbnail_uri?: string;
        creators: Array<{
            creator_address: string;
            creator_name?: string;
        }>;
    };
}

export interface ApiResponse<T> {
    success: boolean;
    data?: T;
    error?: string;
}

export interface TezosCollection {
    contract: string;
    name: string;
    description?: string | undefined;
    logo?: string | undefined;
    collectionType?: string | undefined;
    floorPrice?: number | undefined;
    items?: number | undefined;
    editions?: number | undefined;
    owners?: number | undefined;
    twitter?: string | undefined;
    website?: string | undefined;
    volume24h?: number | undefined;
    volumeTotal?: number | undefined;
    verifiedCreators?: string[] | undefined;
    marketplace: {
        name: string;
        url: string;
    };
}

export interface CollectionMatch {
    marketplace: string;
    contractAddress?: string | undefined;
    projectId?: string | undefined;
    url: string;
}
