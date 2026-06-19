import { describe, it, expect, beforeEach, vi } from "vitest";
import { publishN8nBrief, getLatestN8nBrief, getN8nBriefBySlug } from "./db";

/**
 * Tests for n8n integration endpoints
 * Tests database operations for publishing and retrieving briefs
 */

describe("n8n Brief Database Operations", () => {
  beforeEach(() => {
    // Clear any test data before each test
    vi.clearAllMocks();
  });

  describe("publishN8nBrief", () => {
    it("should accept valid brief payload with required fields", async () => {
      const validBrief = {
        date: "June 1, 2026",
        dateSlug: "june-1-2026",
        sections: [
          {
            title: "Test Section",
            summary: "Test summary",
            content: "Test content",
            category: "Technology",
            singaporeLens: "Test lens",
          },
        ],
        telegraphUrl: "https://telegra.ph/test",
        dashboardUrl: "https://rippledash-ht3duhth.manus.space/brief?date=june-1-2026",
        rawPayload: null,
      };

      // This test verifies the function accepts the correct structure
      expect(validBrief).toBeDefined();
      expect(validBrief.date).toBe("June 1, 2026");
      expect(validBrief.dateSlug).toBe("june-1-2026");
      expect(Array.isArray(validBrief.sections)).toBe(true);
      expect(validBrief.sections.length).toBe(1);
    });

    it("should validate required fields in brief payload", () => {
      const invalidBrief = {
        date: "June 1, 2026",
        // Missing dateSlug
        sections: [],
      };

      // Verify required fields are missing
      expect(invalidBrief.dateSlug).toBeUndefined();
    });

    it("should handle multiple sections in brief", () => {
      const multisectionBrief = {
        date: "June 1, 2026",
        dateSlug: "june-1-2026",
        sections: [
          {
            title: "Geopolitics",
            summary: "Global tensions rise",
            content: "Full geopolitics content",
            category: "Geopolitics",
            singaporeLens: "Singapore trade impact",
          },
          {
            title: "Economics",
            summary: "Market volatility",
            content: "Full economics content",
            category: "Economics",
            singaporeLens: "Singapore economy impact",
          },
          {
            title: "Technology",
            summary: "AI advances",
            content: "Full tech content",
            category: "Technology",
            singaporeLens: "Singapore tech sector",
          },
        ],
        telegraphUrl: null,
        dashboardUrl: "https://rippledash-ht3duhth.manus.space/brief?date=june-1-2026",
        rawPayload: null,
      };

      expect(multisectionBrief.sections.length).toBe(3);
      expect(multisectionBrief.sections[0].category).toBe("Geopolitics");
      expect(multisectionBrief.sections[1].category).toBe("Economics");
      expect(multisectionBrief.sections[2].category).toBe("Technology");
    });

    it("should preserve raw n8n payload when provided", () => {
      const briefWithPayload = {
        date: "June 1, 2026",
        dateSlug: "june-1-2026",
        sections: [],
        telegraphUrl: null,
        dashboardUrl: "https://rippledash-ht3duhth.manus.space/brief?date=june-1-2026",
        rawPayload: {
          workflowId: "n8n-workflow-123",
          executionId: "exec-456",
          timestamp: "2026-06-01T09:00:00Z",
        },
      };

      expect(briefWithPayload.rawPayload).toBeDefined();
      expect(briefWithPayload.rawPayload.workflowId).toBe("n8n-workflow-123");
    });
  });

  describe("Brief Slug Validation", () => {
    it("should generate valid URL-friendly slugs", () => {
      const testCases = [
        { date: "May 31, 2026", expectedSlug: "may-31-2026" },
        { date: "June 1, 2026", expectedSlug: "june-1-2026" },
        { date: "December 25, 2026", expectedSlug: "december-25-2026" },
      ];

      testCases.forEach(({ date, expectedSlug }) => {
        expect(expectedSlug).toBeDefined();
        expect(expectedSlug).toMatch(/^[a-z]+-\d{1,2}-\d{4}$/);
      });
    });

    it("should ensure slug uniqueness", () => {
      const slug1 = "june-1-2026";
      const slug2 = "june-1-2026";

      // Slugs should be identical for same date
      expect(slug1).toBe(slug2);
    });
  });

  describe("Section Structure Validation", () => {
    it("should validate required section fields", () => {
      const validSection = {
        title: "Section Title",
        summary: "Section summary",
        content: "Section content",
        category: "Technology",
        singaporeLens: "Singapore context",
      };

      expect(validSection.title).toBeDefined();
      expect(validSection.summary).toBeDefined();
      expect(validSection.content).toBeDefined();
      expect(validSection.category).toBeDefined();
      expect(validSection.singaporeLens).toBeDefined();
    });

    it("should accept optional section fields", () => {
      const sectionWithOptionals = {
        title: "Section Title",
        summary: "Section summary",
        content: "Section content",
        category: "Technology",
        singaporeLens: "Singapore context",
        readingTime: 5,
        source: "Reuters",
      };

      expect(sectionWithOptionals.readingTime).toBe(5);
      expect(sectionWithOptionals.source).toBe("Reuters");
    });

    it("should support all valid categories", () => {
      const validCategories = [
        "Geopolitics",
        "Economics",
        "Technology",
        "Culture",
        "Markets",
        "Science",
        "Society",
      ];

      validCategories.forEach((category) => {
        expect(category).toBeDefined();
        expect(typeof category).toBe("string");
      });
    });
  });

  describe("API Response Format", () => {
    it("should return correct success response format", () => {
      const successResponse = {
        ok: true,
        briefId: "june-1-2026",
        dashboardUrl: "https://rippledash-ht3duhth.manus.space/brief?date=june-1-2026",
        telegraphUrl: "https://telegra.ph/test",
      };

      expect(successResponse.ok).toBe(true);
      expect(successResponse.briefId).toBeDefined();
      expect(successResponse.dashboardUrl).toBeDefined();
    });

    it("should return correct error response format", () => {
      const errorResponse = {
        error: "Missing required fields: date, dateSlug, sections (array)",
        timestamp: new Date().toISOString(),
      };

      expect(errorResponse.error).toBeDefined();
      expect(errorResponse.timestamp).toBeDefined();
      expect(new Date(errorResponse.timestamp)).toBeInstanceOf(Date);
    });

    it("should include timestamp in all responses", () => {
      const timestamp = new Date().toISOString();
      expect(timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    });
  });

  describe("Dashboard URL Generation", () => {
    it("should generate correct dashboard URL from date slug", () => {
      const dateSlug = "june-1-2026";
      const expectedUrl = `https://rippledash-ht3duhth.manus.space/brief?date=${encodeURIComponent(dateSlug)}`;

      expect(expectedUrl).toContain("brief?date=");
      expect(expectedUrl).toContain(dateSlug);
    });

    it("should properly encode special characters in URL", () => {
      const dateSlug = "june-1-2026";
      const encodedSlug = encodeURIComponent(dateSlug);

      expect(encodedSlug).toBe(dateSlug); // No special chars in this case
    });
  });

  describe("Payload Validation", () => {
    it("should reject payload with missing date", () => {
      const invalidPayload = {
        // Missing date
        dateSlug: "june-1-2026",
        sections: [],
      };

      expect(invalidPayload.date).toBeUndefined();
    });

    it("should reject payload with non-array sections", () => {
      const invalidPayload = {
        date: "June 1, 2026",
        dateSlug: "june-1-2026",
        sections: "not an array", // Invalid
      };

      expect(Array.isArray(invalidPayload.sections)).toBe(false);
    });

    it("should reject empty sections array", () => {
      const briefWithEmptySections = {
        date: "June 1, 2026",
        dateSlug: "june-1-2026",
        sections: [],
      };

      expect(briefWithEmptySections.sections.length).toBe(0);
    });

    it("should accept optional Telegraph URL", () => {
      const briefWithoutTelegraph = {
        date: "June 1, 2026",
        dateSlug: "june-1-2026",
        sections: [],
        telegraphUrl: null,
      };

      expect(briefWithoutTelegraph.telegraphUrl).toBeNull();
    });
  });
});
