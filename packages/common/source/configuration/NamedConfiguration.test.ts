// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import {
    DefaultConfigurationKey,
    NamedConfiguration,
    namedConfigurationGetValue,
} from './NamedConfiguration';

describe('NamedConfiguration', () => {
    describe('DefaultConfigurationKey', () => {
        test('should be "@default"', () => {
            expect(DefaultConfigurationKey).toBe('@default');
        });

        test('should be a string constant', () => {
            expect(typeof DefaultConfigurationKey).toBe('string');
        });

        test('should be immutable', () => {
            const originalValue = DefaultConfigurationKey;
            // In TypeScript/JavaScript, const variables cannot be reassigned
            // This test verifies the constant nature of the export
            expect(DefaultConfigurationKey).toBe(originalValue);
            expect(DefaultConfigurationKey).toBe('@default');
        });
    });

    describe('NamedConfiguration type', () => {
        test('should allow string keys with typed values', () => {
            const config: NamedConfiguration<string> = {
                development: 'dev-value',
                production: 'prod-value',
                [DefaultConfigurationKey]: 'default-value',
            };

            expect(config.development).toBe('dev-value');
            expect(config.production).toBe('prod-value');
            expect(config[DefaultConfigurationKey]).toBe('default-value');
        });

        test('should allow undefined values', () => {
            const config: NamedConfiguration<string> = {
                development: 'dev-value',
                production: undefined,
                [DefaultConfigurationKey]: 'default-value',
            };

            expect(config.development).toBe('dev-value');
            expect(config.production).toBeUndefined();
            expect(config[DefaultConfigurationKey]).toBe('default-value');
        });

        test('should work with complex object types', () => {
            interface DatabaseConfig {
                host: string;
                port: number;
                database: string;
            }

            const config: NamedConfiguration<DatabaseConfig> = {
                development: {
                    host: 'localhost',
                    port: 5432,
                    database: 'dev_db',
                },
                production: {
                    host: 'prod.example.com',
                    port: 5432,
                    database: 'prod_db',
                },
                [DefaultConfigurationKey]: {
                    host: 'default.example.com',
                    port: 3306,
                    database: 'default_db',
                },
            };

            expect(config.development?.host).toBe('localhost');
            expect(config.production?.port).toBe(5432);
            expect(config[DefaultConfigurationKey]?.database).toBe(
                'default_db',
            );
        });

        test('should work with primitive types', () => {
            const numberConfig: NamedConfiguration<number> = {
                development: 3000,
                production: 8080,
                [DefaultConfigurationKey]: 80,
            };

            const booleanConfig: NamedConfiguration<boolean> = {
                development: true,
                production: false,
                [DefaultConfigurationKey]: true,
            };

            expect(numberConfig.development).toBe(3000);
            expect(booleanConfig.production).toBe(false);
        });

        test('should allow empty configuration', () => {
            const config: NamedConfiguration<string> = {};
            expect(Object.keys(config)).toHaveLength(0);
        });

        test('should allow only default configuration', () => {
            const config: NamedConfiguration<string> = {
                [DefaultConfigurationKey]: 'only-default',
            };

            expect(config[DefaultConfigurationKey]).toBe('only-default');
            expect(Object.keys(config)).toHaveLength(1);
        });
    });

    describe('namedConfigurationGetValue function', () => {
        describe('basic functionality', () => {
            test('should return environment-specific value when it exists', () => {
                const config: NamedConfiguration<string> = {
                    development: 'dev-value',
                    production: 'prod-value',
                    [DefaultConfigurationKey]: 'default-value',
                };

                const result = namedConfigurationGetValue(
                    config,
                    'development',
                );
                expect(result).toBe('dev-value');
            });

            test('should return default configuration value when environment not found', () => {
                const config: NamedConfiguration<string> = {
                    development: 'dev-value',
                    [DefaultConfigurationKey]: 'default-value',
                };

                const result = namedConfigurationGetValue(config, 'production');
                expect(result).toBe('default-value');
            });

            test('should return programmatic default when neither environment nor default config exists', () => {
                const config: NamedConfiguration<string> = {
                    development: 'dev-value',
                };

                const result = namedConfigurationGetValue(
                    config,
                    'production',
                    'fallback-value',
                );
                expect(result).toBe('fallback-value');
            });

            test('should return undefined when no values are available', () => {
                const config: NamedConfiguration<string> = {
                    development: 'dev-value',
                };

                const result = namedConfigurationGetValue(config, 'production');
                expect(result).toBeUndefined();
            });
        });

        describe('precedence rules', () => {
            test('should prefer environment value over default configuration', () => {
                const config: NamedConfiguration<string> = {
                    development: 'env-specific-value',
                    [DefaultConfigurationKey]: 'default-value',
                };

                const result = namedConfigurationGetValue(
                    config,
                    'development',
                );
                expect(result).toBe('env-specific-value');
            });

            test('should prefer environment value over programmatic default', () => {
                const config: NamedConfiguration<string> = {
                    development: 'env-specific-value',
                };

                const result = namedConfigurationGetValue(
                    config,
                    'development',
                    'programmatic-default',
                );
                expect(result).toBe('env-specific-value');
            });

            test('should prefer default configuration over programmatic default', () => {
                const config: NamedConfiguration<string> = {
                    [DefaultConfigurationKey]: 'config-default',
                };

                const result = namedConfigurationGetValue(
                    config,
                    'missing-env',
                    'programmatic-default',
                );
                expect(result).toBe('config-default');
            });

            test('should handle all three values present correctly', () => {
                const config: NamedConfiguration<string> = {
                    development: 'env-value',
                    [DefaultConfigurationKey]: 'config-default',
                };

                // Environment value should win
                expect(
                    namedConfigurationGetValue(
                        config,
                        'development',
                        'prog-default',
                    ),
                ).toBe('env-value');

                // Default config should win over programmatic default
                expect(
                    namedConfigurationGetValue(
                        config,
                        'production',
                        'prog-default',
                    ),
                ).toBe('config-default');
            });
        });

        describe('undefined and null value handling', () => {
            test('should treat undefined environment values as missing', () => {
                const config: NamedConfiguration<string> = {
                    development: undefined,
                    [DefaultConfigurationKey]: 'default-value',
                };

                const result = namedConfigurationGetValue(
                    config,
                    'development',
                );
                expect(result).toBe('default-value');
            });

            test('should treat undefined default configuration as missing', () => {
                const config: NamedConfiguration<string> = {
                    [DefaultConfigurationKey]: undefined,
                };

                const result = namedConfigurationGetValue(
                    config,
                    'development',
                    'fallback',
                );
                expect(result).toBe('fallback');
            });

            test('should return null values when explicitly set', () => {
                const config: NamedConfiguration<string | null> = {
                    development: null,
                    [DefaultConfigurationKey]: 'default-value',
                };

                const result = namedConfigurationGetValue(
                    config,
                    'development',
                );
                expect(result).toBeNull();
            });

            test('should handle null in default configuration', () => {
                const config: NamedConfiguration<string | null> = {
                    [DefaultConfigurationKey]: null,
                };

                const result = namedConfigurationGetValue(
                    config,
                    'development',
                );
                expect(result).toBeNull();
            });
        });

        describe('type safety and generics', () => {
            test('should work with number types', () => {
                const config: NamedConfiguration<number> = {
                    development: 3000,
                    production: 8080,
                    [DefaultConfigurationKey]: 80,
                };

                const result = namedConfigurationGetValue(
                    config,
                    'development',
                );
                expect(result).toBe(3000);
                expect(typeof result).toBe('number');
            });

            test('should work with boolean types', () => {
                const config: NamedConfiguration<boolean> = {
                    development: true,
                    production: false,
                    [DefaultConfigurationKey]: true,
                };

                const result = namedConfigurationGetValue(config, 'production');
                expect(result).toBe(false);
                expect(typeof result).toBe('boolean');
            });

            test('should work with complex object types', () => {
                interface ServerConfig {
                    host: string;
                    port: number;
                }

                const config: NamedConfiguration<ServerConfig> = {
                    development: { host: 'localhost', port: 3000 },
                    [DefaultConfigurationKey]: { host: '0.0.0.0', port: 80 },
                };

                const result = namedConfigurationGetValue(
                    config,
                    'development',
                );
                expect(result).toEqual({ host: 'localhost', port: 3000 });
                expect(result?.host).toBe('localhost');
            });

            test('should work with array types', () => {
                const config: NamedConfiguration<string[]> = {
                    development: ['dev-server-1', 'dev-server-2'],
                    production: [
                        'prod-server-1',
                        'prod-server-2',
                        'prod-server-3',
                    ],
                    [DefaultConfigurationKey]: ['default-server'],
                };

                const result = namedConfigurationGetValue(
                    config,
                    'development',
                );
                expect(result).toEqual(['dev-server-1', 'dev-server-2']);
                expect(Array.isArray(result)).toBe(true);
            });

            test('should work with union types', () => {
                const config: NamedConfiguration<string | number> = {
                    development: 'dev-string',
                    production: 42,
                    [DefaultConfigurationKey]: 'default-string',
                };

                expect(namedConfigurationGetValue(config, 'development')).toBe(
                    'dev-string',
                );
                expect(namedConfigurationGetValue(config, 'production')).toBe(
                    42,
                );
            });
        });

        describe('edge cases and error conditions', () => {
            test('should handle empty configuration object', () => {
                const config: NamedConfiguration<string> = {};
                const result = namedConfigurationGetValue(
                    config,
                    'any-environment',
                );
                expect(result).toBeUndefined();
            });

            test('should handle empty configuration with programmatic default', () => {
                const config: NamedConfiguration<string> = {};
                const result = namedConfigurationGetValue(
                    config,
                    'any-environment',
                    'fallback',
                );
                expect(result).toBe('fallback');
            });

            test('should handle special characters in environment names', () => {
                const config: NamedConfiguration<string> = {
                    'env-with-dashes': 'dash-value',
                    env_with_underscores: 'underscore-value',
                    'env.with.dots': 'dot-value',
                    'env with spaces': 'space-value',
                    '123numeric': 'numeric-value',
                    [DefaultConfigurationKey]: 'default-value',
                };

                expect(
                    namedConfigurationGetValue(config, 'env-with-dashes'),
                ).toBe('dash-value');
                expect(
                    namedConfigurationGetValue(config, 'env_with_underscores'),
                ).toBe('underscore-value');
                expect(
                    namedConfigurationGetValue(config, 'env.with.dots'),
                ).toBe('dot-value');
                expect(
                    namedConfigurationGetValue(config, 'env with spaces'),
                ).toBe('space-value');
                expect(namedConfigurationGetValue(config, '123numeric')).toBe(
                    'numeric-value',
                );
            });

            test('should handle empty string as environment name', () => {
                const config: NamedConfiguration<string> = {
                    '': 'empty-string-env',
                    [DefaultConfigurationKey]: 'default-value',
                };

                const result = namedConfigurationGetValue(config, '');
                expect(result).toBe('empty-string-env');
            });

            test('should handle default configuration key as environment name', () => {
                const config: NamedConfiguration<string> = {
                    [DefaultConfigurationKey]: 'default-value',
                };

                // Requesting the default key as an environment should return its value
                const result = namedConfigurationGetValue(
                    config,
                    DefaultConfigurationKey,
                );
                expect(result).toBe('default-value');
            });

            test('should handle large configuration objects', () => {
                const config: NamedConfiguration<number> = {};

                // Add many environments
                for (let i = 0; i < 1000; i++) {
                    config[`env-${i}`] = i;
                }
                config[DefaultConfigurationKey] = -1;

                expect(namedConfigurationGetValue(config, 'env-500')).toBe(500);
                expect(namedConfigurationGetValue(config, 'env-999')).toBe(999);
                expect(namedConfigurationGetValue(config, 'missing-env')).toBe(
                    -1,
                );
            });

            test('should handle configuration with special property names', () => {
                const config: NamedConfiguration<string> = {
                    constructor: 'constructor-value',
                    toString: 'toString-value',
                    hasOwnProperty: 'hasOwnProperty-value',
                    [DefaultConfigurationKey]: 'default-value',
                };

                // These should work as regular property names
                expect(namedConfigurationGetValue(config, 'constructor')).toBe(
                    'constructor-value',
                );
                expect(namedConfigurationGetValue(config, 'toString')).toBe(
                    'toString-value',
                );
                expect(
                    namedConfigurationGetValue(config, 'hasOwnProperty'),
                ).toBe('hasOwnProperty-value');
            });
        });

        describe('realistic usage scenarios', () => {
            test('should handle database configuration', () => {
                interface DatabaseConfig {
                    host: string;
                    port: number;
                    database: string;
                    ssl: boolean;
                }

                const config: NamedConfiguration<DatabaseConfig> = {
                    development: {
                        host: 'localhost',
                        port: 5432,
                        database: 'myapp_dev',
                        ssl: false,
                    },
                    test: {
                        host: 'localhost',
                        port: 5432,
                        database: 'myapp_test',
                        ssl: false,
                    },
                    production: {
                        host: 'prod-db.example.com',
                        port: 5432,
                        database: 'myapp_prod',
                        ssl: true,
                    },
                    [DefaultConfigurationKey]: {
                        host: 'localhost',
                        port: 5432,
                        database: 'myapp',
                        ssl: false,
                    },
                };

                const devConfig = namedConfigurationGetValue(
                    config,
                    'development',
                );
                expect(devConfig?.host).toBe('localhost');
                expect(devConfig?.ssl).toBe(false);

                const prodConfig = namedConfigurationGetValue(
                    config,
                    'production',
                );
                expect(prodConfig?.host).toBe('prod-db.example.com');
                expect(prodConfig?.ssl).toBe(true);

                const stagingConfig = namedConfigurationGetValue(
                    config,
                    'staging',
                );
                expect(stagingConfig?.host).toBe('localhost'); // default
                expect(stagingConfig?.database).toBe('myapp'); // default
            });

            test('should handle API configuration with different base URLs', () => {
                interface ApiConfig {
                    baseUrl: string;
                    timeout: number;
                    retries: number;
                }

                const config: NamedConfiguration<ApiConfig> = {
                    development: {
                        baseUrl: 'http://localhost:3001/api',
                        timeout: 10000,
                        retries: 1,
                    },
                    production: {
                        baseUrl: 'https://api.example.com',
                        timeout: 5000,
                        retries: 3,
                    },
                    [DefaultConfigurationKey]: {
                        baseUrl: 'https://api-staging.example.com',
                        timeout: 7500,
                        retries: 2,
                    },
                };

                expect(
                    namedConfigurationGetValue(config, 'development')?.baseUrl,
                ).toBe('http://localhost:3001/api');
                expect(
                    namedConfigurationGetValue(config, 'production')?.retries,
                ).toBe(3);
                expect(
                    namedConfigurationGetValue(config, 'staging')?.baseUrl,
                ).toBe('https://api-staging.example.com');
            });

            test('should handle feature flags configuration', () => {
                interface FeatureFlags {
                    newDashboard: boolean;
                    betaFeatures: boolean;
                    debugMode: boolean;
                }

                const config: NamedConfiguration<FeatureFlags> = {
                    development: {
                        newDashboard: true,
                        betaFeatures: true,
                        debugMode: true,
                    },
                    production: {
                        newDashboard: false,
                        betaFeatures: false,
                        debugMode: false,
                    },
                    [DefaultConfigurationKey]: {
                        newDashboard: false,
                        betaFeatures: false,
                        debugMode: false,
                    },
                };

                const devFlags = namedConfigurationGetValue(
                    config,
                    'development',
                );
                expect(devFlags?.debugMode).toBe(true);

                const prodFlags = namedConfigurationGetValue(
                    config,
                    'production',
                );
                expect(prodFlags?.newDashboard).toBe(false);

                const testFlags = namedConfigurationGetValue(config, 'test');
                expect(testFlags?.betaFeatures).toBe(false); // default
            });

            test('should handle logging level configuration', () => {
                type LogLevel = 'debug' | 'info' | 'warn' | 'error';

                const config: NamedConfiguration<LogLevel> = {
                    development: 'debug',
                    test: 'warn',
                    production: 'error',
                    [DefaultConfigurationKey]: 'info',
                };

                expect(namedConfigurationGetValue(config, 'development')).toBe(
                    'debug',
                );
                expect(namedConfigurationGetValue(config, 'production')).toBe(
                    'error',
                );
                expect(namedConfigurationGetValue(config, 'staging')).toBe(
                    'info',
                ); // default
            });
        });

        describe('integration with real-world patterns', () => {
            test('should work with environment variable-like usage', () => {
                const config: NamedConfiguration<string> = {
                    development: 'dev.example.com',
                    staging: 'staging.example.com',
                    production: 'example.com',
                    [DefaultConfigurationKey]: 'localhost',
                };

                // Simulate getting current environment from process.env or similar
                const environments = [
                    'development',
                    'staging',
                    'production',
                    'test',
                ];

                environments.forEach((env) => {
                    const result = namedConfigurationGetValue(config, env);
                    if (env === 'test') {
                        expect(result).toBe('localhost'); // default
                    } else {
                        expect(result).toBeDefined();
                        expect(typeof result).toBe('string');
                    }
                });
            });

            test('should work with configuration builder pattern', () => {
                interface AppConfig {
                    port: number;
                    host: string;
                }

                function createConfig(): NamedConfiguration<AppConfig> {
                    return {
                        development: { port: 3000, host: 'localhost' },
                        production: { port: 80, host: '0.0.0.0' },
                        [DefaultConfigurationKey]: {
                            port: 8080,
                            host: '127.0.0.1',
                        },
                    };
                }

                const config = createConfig();
                const devConfig = namedConfigurationGetValue(
                    config,
                    'development',
                );

                expect(devConfig?.port).toBe(3000);
                expect(devConfig?.host).toBe('localhost');
            });

            test('should handle configuration merging scenarios', () => {
                const baseConfig: NamedConfiguration<{
                    api: string;
                    db: string;
                }> = {
                    [DefaultConfigurationKey]: {
                        api: 'default-api',
                        db: 'default-db',
                    },
                };

                const envConfig: NamedConfiguration<{
                    api: string;
                    db: string;
                }> = {
                    development: { api: 'dev-api', db: 'dev-db' },
                    production: { api: 'prod-api', db: 'prod-db' },
                };

                // Merge configurations
                const mergedConfig: NamedConfiguration<{
                    api: string;
                    db: string;
                }> = {
                    ...baseConfig,
                    ...envConfig,
                };

                expect(
                    namedConfigurationGetValue(mergedConfig, 'development')
                        ?.api,
                ).toBe('dev-api');
                expect(
                    namedConfigurationGetValue(mergedConfig, 'staging')?.api,
                ).toBe('default-api');
            });
        });
    });
});
