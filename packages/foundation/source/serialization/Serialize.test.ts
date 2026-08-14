// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

/* eslint-disable @typescript-eslint/no-explicit-any */

import { Dictionary } from '@system-inc/base-common/type/Dictionary';
import { SerializableField } from './decorators/SerializableField';
import { SerializableObject } from './decorators/SerializableObject';
import { serialize } from './Serialize';

// Test classes for serialization
@SerializableObject()
class SimpleUser {
    @SerializableField(() => String)
    name: string;

    @SerializableField(() => Number)
    age: number;

    constructor(name: string, age: number) {
        this.name = name;
        this.age = age;
    }
}

@SerializableObject()
class UserWithOptionalFields {
    @SerializableField(() => String)
    name: string;

    @SerializableField(() => String, { optional: true })
    email?: string;

    @SerializableField(() => String, { defaultValue: 'user' })
    role: string;

    constructor(name: string, email?: string, role?: string) {
        this.name = name;
        this.email = email;
        this.role = role ?? 'user';
    }
}

@SerializableObject()
class UserWithCustomFieldNames {
    @SerializableField(() => String, { name: 'full_name' })
    name: string;

    @SerializableField(() => Number, { name: 'user_age' })
    age: number;

    constructor(name: string, age: number) {
        this.name = name;
        this.age = age;
    }
}

@SerializableObject()
class Address {
    @SerializableField(() => String)
    street: string;

    @SerializableField(() => String)
    city: string;

    constructor(street: string, city: string) {
        this.street = street;
        this.city = city;
    }
}

@SerializableObject()
class UserWithAddress {
    @SerializableField(() => String)
    name: string;

    @SerializableField(() => Address)
    address: Address;

    constructor(name: string, address: Address) {
        this.name = name;
        this.address = address;
    }
}

describe('serialize', () => {
    describe('basic serialization', () => {
        it('should serialize a simple object with required fields', () => {
            const user = new SimpleUser('John Doe', 30);
            const result = serialize(user);

            expect(result).toEqual({
                name: 'John Doe',
                age: 30,
            });
        });

        it('should serialize an object with optional fields when provided', () => {
            const user = new UserWithOptionalFields(
                'John Doe',
                'john@example.com',
            );
            const result = serialize(user);

            expect(result).toEqual({
                name: 'John Doe',
                email: 'john@example.com',
                role: 'user',
            });
        });

        it('should serialize an object with optional fields when not provided', () => {
            const user = new UserWithOptionalFields('John Doe');
            const result = serialize(user);

            expect(result).toEqual({
                name: 'John Doe',
                role: 'user',
            });
        });

        it('should use default values when fields are not provided', () => {
            const user = new UserWithOptionalFields('John Doe');
            const result = serialize(user);
            expect(typeof result).toEqual('object');
            expect((result as Dictionary<unknown>).role).toBe('user');
        });

        it('should use custom field names when specified', () => {
            const user = new UserWithCustomFieldNames('John Doe', 30);
            const result = serialize(user);

            expect(result).toEqual({
                full_name: 'John Doe',
                user_age: 30,
            });
        });
    });

    describe('nested object serialization', () => {
        // Test class for contact information
        @SerializableObject()
        class ContactInfo {
            @SerializableField(() => String)
            email: string;

            @SerializableField(() => String)
            phone: string;

            constructor(email: string, phone: string) {
                this.email = email;
                this.phone = phone;
            }
        }

        // Test class for company information
        @SerializableObject()
        class Company {
            @SerializableField(() => String)
            name: string;

            @SerializableField(() => Address)
            headquarters: Address;

            @SerializableField(() => ContactInfo)
            contact: ContactInfo;

            constructor(
                name: string,
                headquarters: Address,
                contact: ContactInfo,
            ) {
                this.name = name;
                this.headquarters = headquarters;
                this.contact = contact;
            }
        }

        // Test class for employee with multi-level nesting
        @SerializableObject()
        class Employee {
            @SerializableField(() => String)
            name: string;

            @SerializableField(() => Address)
            homeAddress: Address;

            @SerializableField(() => Company)
            employer: Company;

            @SerializableField(() => ContactInfo)
            personalContact: ContactInfo;

            constructor(
                name: string,
                homeAddress: Address,
                employer: Company,
                personalContact: ContactInfo,
            ) {
                this.name = name;
                this.homeAddress = homeAddress;
                this.employer = employer;
                this.personalContact = personalContact;
            }
        }

        // Test class with optional nested objects
        @SerializableObject()
        class UserProfile {
            @SerializableField(() => String)
            username: string;

            @SerializableField(() => Address, { optional: true })
            billingAddress?: Address;

            @SerializableField(() => Address, { optional: true })
            shippingAddress?: Address;

            @SerializableField(() => ContactInfo, { optional: true })
            emergencyContact?: ContactInfo;

            constructor(
                username: string,
                billingAddress?: Address,
                shippingAddress?: Address,
                emergencyContact?: ContactInfo,
            ) {
                this.username = username;
                this.billingAddress = billingAddress;
                this.shippingAddress = shippingAddress;
                this.emergencyContact = emergencyContact;
            }
        }

        // Test class with nested objects having custom field names
        @SerializableObject()
        class CustomerRecord {
            @SerializableField(() => String, { name: 'customer_name' })
            name: string;

            @SerializableField(() => Address, { name: 'primary_address' })
            address: Address;

            @SerializableField(() => ContactInfo, { name: 'contact_details' })
            contact: ContactInfo;

            constructor(name: string, address: Address, contact: ContactInfo) {
                this.name = name;
                this.address = address;
                this.contact = contact;
            }
        }

        // Test class with mixed nested structures
        @SerializableObject()
        class Organization {
            @SerializableField(() => String)
            name: string;

            @SerializableField(() => [Address])
            locations: Address[];

            @SerializableField(() => Employee, { optional: true })
            ceo?: Employee;

            @SerializableField(() => [String])
            departments: string[];

            @SerializableField(() => ContactInfo)
            mainContact: ContactInfo;

            constructor(
                name: string,
                locations: Address[],
                mainContact: ContactInfo,
                departments: string[],
                ceo?: Employee,
            ) {
                this.name = name;
                this.locations = locations;
                this.mainContact = mainContact;
                this.departments = departments;
                this.ceo = ceo;
            }
        }

        it('should serialize nested objects', () => {
            const address = new Address('123 Main St', 'New York');
            const user = new UserWithAddress('John Doe', address);
            const result = serialize(user);

            expect(result).toEqual({
                name: 'John Doe',
                address: {
                    street: '123 Main St',
                    city: 'New York',
                },
            });
        });

        it('should serialize objects with multiple nested objects', () => {
            const homeAddress = new Address('123 Elm St', 'Springfield');
            const contact = new ContactInfo('john@example.com', '555-1234');
            const profile = new UserProfile(
                'johndoe',
                homeAddress,
                undefined,
                contact,
            );
            const result = serialize(profile);

            expect(result).toEqual({
                username: 'johndoe',
                billingAddress: {
                    street: '123 Elm St',
                    city: 'Springfield',
                },
                emergencyContact: {
                    email: 'john@example.com',
                    phone: '555-1234',
                },
            });
        });

        it('should serialize multi-level nested objects', () => {
            const headquarters = new Address(
                '456 Corporate Blvd',
                'Business City',
            );
            const companyContact = new ContactInfo(
                'info@company.com',
                '555-9999',
            );
            const company = new Company(
                'Tech Corp',
                headquarters,
                companyContact,
            );

            const homeAddress = new Address('789 Residential St', 'Home Town');
            const personalContact = new ContactInfo(
                'employee@personal.com',
                '555-5555',
            );
            const employee = new Employee(
                'Jane Smith',
                homeAddress,
                company,
                personalContact,
            );

            const result = serialize(employee);

            expect(result).toEqual({
                name: 'Jane Smith',
                homeAddress: {
                    street: '789 Residential St',
                    city: 'Home Town',
                },
                employer: {
                    name: 'Tech Corp',
                    headquarters: {
                        street: '456 Corporate Blvd',
                        city: 'Business City',
                    },
                    contact: {
                        email: 'info@company.com',
                        phone: '555-9999',
                    },
                },
                personalContact: {
                    email: 'employee@personal.com',
                    phone: '555-5555',
                },
            });
        });

        it('should serialize optional nested objects when provided', () => {
            const billingAddress = new Address(
                '123 Billing St',
                'Billing City',
            );
            const shippingAddress = new Address(
                '456 Shipping Ave',
                'Shipping Town',
            );
            const emergencyContact = new ContactInfo(
                'emergency@contact.com',
                '911-911-911',
            );

            const profile = new UserProfile(
                'completuser',
                billingAddress,
                shippingAddress,
                emergencyContact,
            );
            const result = serialize(profile);

            expect(result).toEqual({
                username: 'completuser',
                billingAddress: {
                    street: '123 Billing St',
                    city: 'Billing City',
                },
                shippingAddress: {
                    street: '456 Shipping Ave',
                    city: 'Shipping Town',
                },
                emergencyContact: {
                    email: 'emergency@contact.com',
                    phone: '911-911-911',
                },
            });
        });

        it('should serialize optional nested objects when not provided', () => {
            const profile = new UserProfile('minimaluser');
            const result = serialize(profile);

            expect(result).toEqual({
                username: 'minimaluser',
                // All optional nested objects should be omitted
            });
        });

        it('should serialize nested objects with custom field names', () => {
            const address = new Address('789 Customer St', 'Customer City');
            const contact = new ContactInfo('customer@example.com', '555-CUST');
            const customer = new CustomerRecord(
                'John Customer',
                address,
                contact,
            );
            const result = serialize(customer);

            expect(result).toEqual({
                customer_name: 'John Customer',
                primary_address: {
                    street: '789 Customer St',
                    city: 'Customer City',
                },
                contact_details: {
                    email: 'customer@example.com',
                    phone: '555-CUST',
                },
            });
        });

        it('should serialize complex mixed nested structures', () => {
            const locations = [
                new Address('100 Main Office', 'HQ City'),
                new Address('200 Branch Office', 'Branch City'),
            ];
            const mainContact = new ContactInfo('org@example.com', '555-ORG1');
            const departments = ['Engineering', 'Sales', 'Marketing'];

            const organization = new Organization(
                'Global Corp',
                locations,
                mainContact,
                departments,
            );
            const result = serialize(organization);

            expect(result).toEqual({
                name: 'Global Corp',
                locations: [
                    { street: '100 Main Office', city: 'HQ City' },
                    { street: '200 Branch Office', city: 'Branch City' },
                ],
                departments: ['Engineering', 'Sales', 'Marketing'],
                mainContact: {
                    email: 'org@example.com',
                    phone: '555-ORG1',
                },
                // ceo is optional and not provided, so it should be omitted
            });
        });

        it('should serialize nested objects with null values', () => {
            const profile = new UserProfile(
                'nulluser',
                null as any,
                undefined,
                null as any,
            );
            const result = serialize(profile);

            expect(result).toEqual({
                username: 'nulluser',
                billingAddress: null,
                emergencyContact: null,
                // shippingAddress is undefined, so should be omitted
            });
        });

        it('should serialize deeply nested objects in arrays', () => {
            const contact1 = new ContactInfo(
                'contact1@example.com',
                '555-0001',
            );
            const contact2 = new ContactInfo(
                'contact2@example.com',
                '555-0002',
            );

            const address1 = new Address('100 First St', 'First City');
            const address2 = new Address('200 Second St', 'Second City');

            const company1 = new Company('Company One', address1, contact1);
            const company2 = new Company('Company Two', address2, contact2);

            const companies = [company1, company2];
            const result = serialize(companies);

            expect(result).toEqual([
                {
                    name: 'Company One',
                    headquarters: {
                        street: '100 First St',
                        city: 'First City',
                    },
                    contact: {
                        email: 'contact1@example.com',
                        phone: '555-0001',
                    },
                },
                {
                    name: 'Company Two',
                    headquarters: {
                        street: '200 Second St',
                        city: 'Second City',
                    },
                    contact: {
                        email: 'contact2@example.com',
                        phone: '555-0002',
                    },
                },
            ]);
        });
    });

    describe('array serialization', () => {
        // Test class with arrays of primitive types
        @SerializableObject()
        class UserWithArrays {
            @SerializableField(() => String)
            name: string;

            @SerializableField(() => [String])
            hobbies: string[];

            @SerializableField(() => [Number])
            scores: number[];

            @SerializableField(() => [Boolean])
            flags: boolean[];

            constructor(
                name: string,
                hobbies: string[],
                scores: number[],
                flags: boolean[],
            ) {
                this.name = name;
                this.hobbies = hobbies;
                this.scores = scores;
                this.flags = flags;
            }
        }

        // Test class with arrays of complex objects
        @SerializableObject()
        class UserWithComplexArrays {
            @SerializableField(() => String)
            name: string;

            @SerializableField(() => [Address])
            addresses: Address[];

            @SerializableField(() => [SimpleUser])
            friends: SimpleUser[];

            constructor(
                name: string,
                addresses: Address[],
                friends: SimpleUser[],
            ) {
                this.name = name;
                this.addresses = addresses;
                this.friends = friends;
            }
        }

        // Test class with nested arrays
        @SerializableObject()
        class UserWithNestedArrays {
            @SerializableField(() => String)
            name: string;

            @SerializableField(() => [[Number]])
            skillMatrix: number[][];

            @SerializableField(() => [[String]])
            groupedHobbies: string[][];

            constructor(
                name: string,
                skillMatrix: number[][],
                groupedHobbies: string[][],
            ) {
                this.name = name;
                this.skillMatrix = skillMatrix;
                this.groupedHobbies = groupedHobbies;
            }
        }

        // Test class with mixed arrays
        @SerializableObject()
        class UserWithMixedArrays {
            @SerializableField(() => String)
            name: string;

            @SerializableField(() => [String], { optional: true })
            optionalTags?: string[];

            @SerializableField(() => [Number], { defaultValue: [0, 1, 2] })
            defaultNumbers: number[];

            @SerializableField(() => [String], { name: 'custom_array' })
            customArray: string[];

            constructor(
                name: string,
                customArray: string[],
                optionalTags?: string[],
                defaultNumbers?: number[],
            ) {
                this.name = name;
                this.customArray = customArray;
                this.optionalTags = optionalTags;
                this.defaultNumbers = defaultNumbers || [0, 1, 2];
            }
        }

        it('should serialize an array of objects', () => {
            const users = [
                new SimpleUser('John Doe', 30),
                new SimpleUser('Jane Smith', 25),
            ];
            const result = serialize(users);

            expect(result).toEqual([
                { name: 'John Doe', age: 30 },
                { name: 'Jane Smith', age: 25 },
            ]);
        });

        it('should serialize arrays of primitive types', () => {
            const user = new UserWithArrays(
                'John Doe',
                ['reading', 'gaming', 'cooking'],
                [95, 87, 92],
                [true, false, true],
            );
            const result = serialize(user);

            expect(result).toEqual({
                name: 'John Doe',
                hobbies: ['reading', 'gaming', 'cooking'],
                scores: [95, 87, 92],
                flags: [true, false, true],
            });
        });

        it('should serialize empty arrays', () => {
            const user = new UserWithArrays('John Doe', [], [], []);
            const result = serialize(user);

            expect(result).toEqual({
                name: 'John Doe',
                hobbies: [],
                scores: [],
                flags: [],
            });
        });

        it('should serialize arrays of complex objects', () => {
            const addresses = [
                new Address('123 Main St', 'New York'),
                new Address('456 Oak Ave', 'Los Angeles'),
            ];
            const friends = [
                new SimpleUser('Alice', 28),
                new SimpleUser('Bob', 32),
            ];
            const user = new UserWithComplexArrays(
                'John Doe',
                addresses,
                friends,
            );
            const result = serialize(user);

            expect(result).toEqual({
                name: 'John Doe',
                addresses: [
                    { street: '123 Main St', city: 'New York' },
                    { street: '456 Oak Ave', city: 'Los Angeles' },
                ],
                friends: [
                    { name: 'Alice', age: 28 },
                    { name: 'Bob', age: 32 },
                ],
            });
        });

        it('should serialize nested arrays (arrays of arrays)', () => {
            const user = new UserWithNestedArrays(
                'John Doe',
                [
                    [1, 2, 3],
                    [4, 5, 6],
                    [7, 8, 9],
                ],
                [
                    ['reading', 'writing'],
                    ['gaming', 'streaming'],
                    ['cooking', 'baking'],
                ],
            );
            const result = serialize(user);

            expect(result).toEqual({
                name: 'John Doe',
                skillMatrix: [
                    [1, 2, 3],
                    [4, 5, 6],
                    [7, 8, 9],
                ],
                groupedHobbies: [
                    ['reading', 'writing'],
                    ['gaming', 'streaming'],
                    ['cooking', 'baking'],
                ],
            });
        });

        it('should serialize arrays with optional and default values', () => {
            const user = new UserWithMixedArrays('John Doe', ['a', 'b', 'c']);
            const result = serialize(user);

            expect(result).toEqual({
                name: 'John Doe',
                custom_array: ['a', 'b', 'c'],
                defaultNumbers: [0, 1, 2],
                // optionalTags should be undefined and not included
            });
        });

        it('should serialize arrays with provided optional values', () => {
            const user = new UserWithMixedArrays(
                'John Doe',
                ['a', 'b'],
                ['tag1', 'tag2'],
                [10, 20],
            );
            const result = serialize(user);

            expect(result).toEqual({
                name: 'John Doe',
                custom_array: ['a', 'b'],
                optionalTags: ['tag1', 'tag2'],
                defaultNumbers: [10, 20],
            });
        });

        it('should serialize arrays containing null and undefined values', () => {
            const user = new UserWithArrays(
                'John Doe',
                ['valid', null as any, undefined as any],
                [1, null as any, 3],
                [true, null as any, false],
            );
            const result = serialize(user);

            expect(result).toEqual({
                name: 'John Doe',
                hobbies: ['valid', null, undefined],
                scores: [1, null, 3],
                flags: [true, null, false],
            });
        });

        it('should serialize deeply nested mixed arrays', () => {
            // Create a complex nested structure
            const addresses = [
                new Address('123 Main St', 'New York'),
                new Address('456 Oak Ave', 'Los Angeles'),
            ];
            const complexUser = new UserWithComplexArrays(
                'Parent User',
                addresses,
                [],
            );

            // Create an array containing objects that themselves contain arrays
            const complexArray = [complexUser];
            const result = serialize(complexArray);

            expect(result).toEqual([
                {
                    name: 'Parent User',
                    addresses: [
                        { street: '123 Main St', city: 'New York' },
                        { street: '456 Oak Ave', city: 'Los Angeles' },
                    ],
                    friends: [],
                },
            ]);
        });

        it('should serialize single-element arrays', () => {
            const user = new UserWithArrays(
                'John Doe',
                ['single'],
                [42],
                [true],
            );
            const result = serialize(user);

            expect(result).toEqual({
                name: 'John Doe',
                hobbies: ['single'],
                scores: [42],
                flags: [true],
            });
        });
    });

    describe('primitive value handling', () => {
        it('should return null for null or undefined', () => {
            expect((serialize as any)(null)).toBe(null);
            expect((serialize as any)(undefined)).toBe(null);
        });

        it('should return primitive values', () => {
            expect((serialize as any)('hello')).toBe('hello');
            expect((serialize as any)(42)).toBe(42);
            expect((serialize as any)(true)).toBe(true);
            expect((serialize as any)(false)).toBe(false);
        });
    });

    describe('error handling', () => {
        it('should throw error for required fields that are missing', () => {
            const user = new SimpleUser('John Doe', 30);
            delete (user as any).name; // Remove required field

            expect(() => serialize(user)).toThrow(
                'Field name is required but not present in SimpleUser.',
            );
        });

        it('should throw error for objects without @SerializableObject decorator', () => {
            class UnmarkedClass {
                value = 'test';
            }
            const obj = new UnmarkedClass();

            expect(() => serialize(obj)).toThrow(
                'No @SerializableObject metadata for UnmarkedClass',
            );
        });

        it('should throw error for objects without constructor', () => {
            const obj = Object.create(null);
            obj.value = 'test';

            expect(() => serialize(obj)).toThrow(
                'Value must be an instance of a class with a constructor.',
            );
        });
    });

    describe('circular reference handling', () => {
        @SerializableObject()
        class CircularUser {
            @SerializableField(() => String)
            name: string;

            @SerializableField(() => CircularUser, { optional: true })
            friend?: CircularUser;

            constructor(name: string) {
                this.name = name;
            }
        }

        it('should throw error on circular references by default', () => {
            const user1 = new CircularUser('John');
            const user2 = new CircularUser('Jane');
            user1.friend = user2;
            user2.friend = user1; // Create circular reference

            expect(() => serialize(user1)).toThrow(
                'Circular reference detected in serialization.',
            );
        });

        it('should omit circular references when onCycle is "omit"', () => {
            const user1 = new CircularUser('John');
            const user2 = new CircularUser('Jane');
            user1.friend = user2;
            user2.friend = user1; // Create circular reference

            const result = serialize(user1, { onCycle: 'omit' });

            expect(result).toEqual({
                name: 'John',
                friend: {
                    name: 'Jane',
                    // friend field omitted due to circular reference
                },
            });
        });

        it('should replace circular references with null when onCycle is "null"', () => {
            const user1 = new CircularUser('John');
            const user2 = new CircularUser('Jane');
            user1.friend = user2;
            user2.friend = user1; // Create circular reference

            const result = serialize(user1, { onCycle: 'null' });

            expect(result).toEqual({
                name: 'John',
                friend: {
                    name: 'Jane',
                    friend: null, // Circular reference replaced with null
                },
            });
        });
    });

    describe('raw object passthrough', () => {
        @SerializableObject()
        class UserWithRawField {
            @SerializableField(() => String)
            name: string;

            @SerializableField()
            metadata: Record<string, unknown>;

            @SerializableField()
            settings: object;

            constructor(
                name: string,
                metadata: Record<string, unknown>,
                settings: object,
            ) {
                this.name = name;
                this.metadata = metadata;
                this.settings = settings;
            }
        }

        @SerializableObject()
        class UserWithOptionalRawField {
            @SerializableField(() => String)
            name: string;

            @SerializableField(undefined, { optional: true })
            optionalData?: any;

            @SerializableField(undefined, { defaultValue: { theme: 'light' } })
            defaultConfig: any;

            constructor(name: string, optionalData?: any, defaultConfig?: any) {
                this.name = name;
                this.optionalData = optionalData;
                this.defaultConfig = defaultConfig ?? { theme: 'light' };
            }
        }

        @SerializableObject()
        class UserWithNestedRawFields {
            @SerializableField(() => String)
            name: string;

            @SerializableField()
            profile: {
                avatar: string;
                preferences: Record<string, unknown>;
                history: any[];
            };

            constructor(name: string, profile: any) {
                this.name = name;
                this.profile = profile;
            }
        }

        it('should serialize raw object fields without type transformation', () => {
            const metadata = {
                userId: 123,
                tags: ['admin', 'premium'],
                lastLogin: '2023-01-01T00:00:00Z',
                preferences: {
                    theme: 'dark',
                    language: 'en',
                    notifications: true,
                },
            };
            const settings = {
                autoSave: true,
                maxFileSize: 5242880,
                allowedFormats: ['jpg', 'png', 'pdf'],
            };

            const user = new UserWithRawField('John Doe', metadata, settings);
            const result = serialize(user);

            expect(result).toEqual({
                name: 'John Doe',
                metadata: {
                    userId: 123,
                    tags: ['admin', 'premium'],
                    lastLogin: '2023-01-01T00:00:00Z',
                    preferences: {
                        theme: 'dark',
                        language: 'en',
                        notifications: true,
                    },
                },
                settings: {
                    autoSave: true,
                    maxFileSize: 5242880,
                    allowedFormats: ['jpg', 'png', 'pdf'],
                },
            });
        });

        it('should serialize complex nested objects without type constraints', () => {
            const profile = {
                avatar: 'https://example.com/avatar.jpg',
                preferences: {
                    theme: 'dark',
                    language: 'en',
                    customFields: {
                        field1: 'value1',
                        field2: [1, 2, 3],
                        field3: { nested: true, count: 42 },
                    },
                },
                history: [
                    { action: 'login', timestamp: '2023-01-01T10:00:00Z' },
                    {
                        action: 'edit_profile',
                        timestamp: '2023-01-01T10:30:00Z',
                        data: { field: 'email' },
                    },
                    { action: 'logout', timestamp: '2023-01-01T11:00:00Z' },
                ],
            };

            const user = new UserWithNestedRawFields('Jane Smith', profile);
            const result = serialize(user);

            expect(result).toEqual({
                name: 'Jane Smith',
                profile: {
                    avatar: 'https://example.com/avatar.jpg',
                    preferences: {
                        theme: 'dark',
                        language: 'en',
                        customFields: {
                            field1: 'value1',
                            field2: [1, 2, 3],
                            field3: { nested: true, count: 42 },
                        },
                    },
                    history: [
                        { action: 'login', timestamp: '2023-01-01T10:00:00Z' },
                        {
                            action: 'edit_profile',
                            timestamp: '2023-01-01T10:30:00Z',
                            data: { field: 'email' },
                        },
                        { action: 'logout', timestamp: '2023-01-01T11:00:00Z' },
                    ],
                },
            });
        });

        it('should serialize optional raw fields when provided', () => {
            const optionalData = {
                customId: 'custom-123',
                flags: [true, false, true],
                dynamicContent: {
                    type: 'json',
                    content: { message: 'Hello World' },
                },
            };

            const user = new UserWithOptionalRawField('Alice', optionalData);
            const result = serialize(user);

            expect(result).toEqual({
                name: 'Alice',
                optionalData: {
                    customId: 'custom-123',
                    flags: [true, false, true],
                    dynamicContent: {
                        type: 'json',
                        content: { message: 'Hello World' },
                    },
                },
                defaultConfig: { theme: 'light' },
            });
        });

        it('should serialize optional raw fields when not provided', () => {
            const user = new UserWithOptionalRawField('Bob');
            const result = serialize(user);

            expect(result).toEqual({
                name: 'Bob',
                defaultConfig: { theme: 'light' },
            });
        });

        it('should use default values for raw fields when specified', () => {
            const user = new UserWithOptionalRawField('Charlie', undefined, {
                theme: 'dark',
                fontSize: 14,
            });
            const result = serialize(user);

            expect(result).toEqual({
                name: 'Charlie',
                defaultConfig: { theme: 'dark', fontSize: 14 },
            });
        });

        it('should handle null values in raw fields', () => {
            const user = new UserWithRawField('David', null as any, {
                setting: 'value',
            });
            const result = serialize(user);

            expect(result).toEqual({
                name: 'David',
                metadata: null,
                settings: { setting: 'value' },
            });
        });

        it('should preserve primitive types in raw fields', () => {
            const user = new UserWithRawField(
                'Eve',
                'just a string' as any,
                42 as any,
            );
            const result = serialize(user);

            expect(result).toEqual({
                name: 'Eve',
                metadata: 'just a string',
                settings: 42,
            });
        });

        it('should handle arrays in raw fields', () => {
            const metadata = [
                'item1',
                'item2',
                { complex: 'object' },
                123,
                true,
            ];
            const settings = [
                { name: 'setting1', value: true },
                { name: 'setting2', value: 'text' },
                { name: 'setting3', value: [1, 2, 3] },
            ];

            const user = new UserWithRawField(
                'Frank',
                metadata as any,
                settings as any,
            );
            const result = serialize(user);

            expect(result).toEqual({
                name: 'Frank',
                metadata: ['item1', 'item2', { complex: 'object' }, 123, true],
                settings: [
                    { name: 'setting1', value: true },
                    { name: 'setting2', value: 'text' },
                    { name: 'setting3', value: [1, 2, 3] },
                ],
            });
        });
    });

    describe('unannotated field handling', () => {
        @SerializableObject()
        class UserWithUnannotatedFields {
            @SerializableField(() => String)
            name: string;

            @SerializableField(() => Number)
            age: number;

            // These fields should be ignored during serialization
            internalId: string;
            tempData: object;
            privateFlag: boolean;

            constructor(name: string, age: number) {
                this.name = name;
                this.age = age;
                this.internalId = 'internal-123';
                this.tempData = { temp: true };
                this.privateFlag = false;
            }
        }

        @SerializableObject()
        class UserWithMixedFields {
            @SerializableField(() => String)
            publicName: string;

            // Unannotated field
            privateEmail: string;

            @SerializableField(() => Number, { optional: true })
            publicAge?: number;

            // Another unannotated field
            internalNotes: string[];

            @SerializableField(() => String, { defaultValue: 'user' })
            role: string;

            constructor(
                publicName: string,
                privateEmail: string = '',
                publicAge?: number,
                role: string = 'user',
            ) {
                this.publicName = publicName;
                this.privateEmail = privateEmail;
                this.publicAge = publicAge;
                this.internalNotes = ['note1', 'note2'];
                this.role = role;
            }
        }

        it('should ignore fields without @SerializableField decorator', () => {
            const user = new UserWithUnannotatedFields('John Doe', 30);
            const result = serialize(user);

            expect(result).toEqual({
                name: 'John Doe',
                age: 30,
                // internalId, tempData, and privateFlag should be absent
            });

            // Ensure the unannotated fields are not present in the result
            expect(result).not.toHaveProperty('internalId');
            expect(result).not.toHaveProperty('tempData');
            expect(result).not.toHaveProperty('privateFlag');
        });

        it('should only serialize annotated fields in mixed classes', () => {
            const user = new UserWithMixedFields(
                'Jane Smith',
                'jane@private.com',
                25,
            );
            const result = serialize(user);

            expect(result).toEqual({
                publicName: 'Jane Smith',
                publicAge: 25,
                role: 'user',
                // privateEmail and internalNotes should be absent
            });

            // Ensure the unannotated fields are not present in the result
            expect(result).not.toHaveProperty('privateEmail');
            expect(result).not.toHaveProperty('internalNotes');
        });

        it('should handle unannotated fields with optional annotated fields', () => {
            const user = new UserWithMixedFields(
                'Bob Wilson',
                'bob@private.com',
            ); // publicAge omitted
            const result = serialize(user);

            expect(result).toEqual({
                publicName: 'Bob Wilson',
                publicAge: undefined, // optional and not provided, so set to undefined
                role: 'user',
                // privateEmail and internalNotes should be absent (unannotated)
            });
            expect(result).not.toHaveProperty('privateEmail');
            expect(result).not.toHaveProperty('internalNotes');
        });

        it('should ignore unannotated fields even if they have complex types', () => {
            const user = new UserWithUnannotatedFields('Complex User', 35);
            // Add some complex data to unannotated fields
            user.tempData = {
                nested: {
                    object: {
                        with: ['arrays', 'and', { complex: 'structures' }],
                    },
                },
                functions: () => 'should be ignored',
                date: new Date(),
            };

            const result = serialize(user);

            expect(result).toEqual({
                name: 'Complex User',
                age: 35,
            });

            expect(result).not.toHaveProperty('tempData');
        });
    });
});
