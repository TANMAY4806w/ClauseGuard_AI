import fitz

def generate_sample_contract():
    doc = fitz.open()

    # Page 1
    p1 = doc.new_page()
    p1.insert_text(
        (50, 72),
        "VENDOR MASTER SERVICES AGREEMENT (2026)\n\n"
        "Article I: Definitions and Term\n"
        "This Agreement is entered into on January 15, 2026. The initial term shall be twelve (12) months.\n\n"
        "Section 14.2 Automatic Renewal and Cancellation\n"
        "Unless Customer provides written notice of non-renewal at least ninety (90) days prior to the expiration "
        "of the Initial Term, this Agreement shall automatically renew for successive twelve (12) month periods.\n\n"
        "Section 8.1 Payment Terms and Invoicing\n"
        "Customer shall pay all undisputed invoices within thirty (30) days of receipt.",
        fontsize=11
    )

    # Page 2
    p2 = doc.new_page()
    p2.insert_text(
        (50, 72),
        "Article II: Indemnification and Liability\n\n"
        "Section 9.1 Uncapped Asymmetric Indemnification\n"
        "Customer shall defend, indemnify, and hold harmless Vendor from and against any and all third-party claims, "
        "liabilities, damages, and reasonable attorney fees without limitation of liability.\n\n"
        "Section 11.4 Choice of Law and Jurisdiction\n"
        "This Agreement shall be governed by the laws of the State of Delaware, and the exclusive venue for disputes "
        "shall be the courts of Wilmington, Delaware.",
        fontsize=11
    )

    doc.save("sample_contract.pdf")
    doc.close()
    print("sample_contract.pdf created successfully!")

if __name__ == "__main__":
    generate_sample_contract()
