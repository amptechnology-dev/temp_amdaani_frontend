import React, { forwardRef } from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { Text, useTheme, Divider } from 'react-native-paper';
import BaseBottomSheet from './BaseBottomSheet';
import LinearGradient from 'react-native-linear-gradient';

const TermsBottomSheet = forwardRef(
  (
    {
      onAccept,
      showAcceptButton = false,
      initialSnapIndex = -1,
      showCloseButton = true,
      enableDismissOnClose = true,
      backdropbehavior = 'close',
    },
    ref,
  ) => {
    const theme = useTheme();

    const renderFooter = (
      <>
        {showAcceptButton && (
          <View
            style={[
              styles.footerContainer,
              {
                backgroundColor: theme.colors.surface,
                borderTopColor: theme.colors.outlineVariant,
              },
            ]}
          >
            <TouchableOpacity
              onPress={onAccept}
              activeOpacity={0.8}
              style={styles.acceptButtonWrapper}
            >
              <LinearGradient
                colors={[theme.colors.secondary, theme.colors.primary]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.acceptButton}
              >
                <Text
                  variant="titleLarge"
                  style={[
                    styles.acceptButtonText,
                    { color: theme.colors.onPrimary },
                  ]}
                >
                  ✓ I Accept Terms & Conditions
                </Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        )}
      </>
    );

    return (
      <BaseBottomSheet
        ref={ref}
        title="Terms & Conditions"
        subtitle="Please read carefully before using our services"
        snapPoints={['70%', '90%']}
        initialSnapIndex={initialSnapIndex}
        showHeader={true}
        enablePanDownToClose={false}
        showCloseButton={showCloseButton}
        contentType="scroll"
        enableDismissOnClose={enableDismissOnClose}
        backdropbehavior={backdropbehavior}
        footerComponent={renderFooter}
        showFooter={showAcceptButton}
        contentContainerStyle={styles.contentContainer}
      >
        <View style={styles.container}>
          {/* Last Updated */}
          <Text variant="bodySmall" style={styles.updatedText}>
            Last Updated: June 6, 2026
          </Text>

          <Divider
            style={[styles.divider, { backgroundColor: theme.colors.outline }]}
          />

          {/* 1. Introduction */}
          <View style={styles.section}>
            <Text variant="titleMedium" style={styles.sectionTitle}>
              1. Introduction and Acceptance of Terms
            </Text>
            <Text variant="bodyMedium" style={styles.paragraph}>
              Welcome to the billing, invoicing, inventory, and business
              management application <Text style={styles.bold}>AMDAANI</Text>,
              developed and operated by{' '}
              <Text style={styles.bold}>AMP Technology</Text>.
            </Text>
            <Text
              variant="bodyMedium"
              style={[styles.paragraph, { marginTop: 8 }]}
            >
              These Terms & Conditions govern the access and use of the App,
              website, services, software, reports, tools, and all related
              features provided by the Company. By accessing, registering,
              downloading, installing, or using the App in any manner, you agree
              to comply with and be legally bound by these Terms & Conditions.{' '}
              <Text style={styles.bold}>
                If you do not agree with any part of these Terms, you must
                immediately discontinue use of the App and all related services.
              </Text>
            </Text>
            <Text
              variant="bodyMedium"
              style={[styles.paragraph, { marginTop: 8 }]}
            >
              The App is intended to assist businesses, shop owners, traders,
              distributors, wholesalers, retailers, service providers, and
              organizations in managing invoices, billing operations, stock
              records, purchase entries, sales entries, customer information,
              supplier details, tax calculations, and reporting processes
              digitally and efficiently.
            </Text>
          </View>

          {/* Information We Collect */}
          <View style={styles.section}>
            <Text variant="titleMedium" style={styles.sectionTitle}>
              Information We Collect
            </Text>
            <Text variant="bodyMedium" style={styles.paragraph}>
              The App may collect, store, process, and manage various categories
              of information necessary for providing billing, invoicing,
              inventory management, reporting, customer management, and related
              business services. Such information may include business details,
              Business Type, company name, GST numbers, tax-related information,
              billing addresses, contact information (Phone No, E-mail Address),
              customer and supplier records, invoice data, purchase and sales
              history, payment records, transaction details, stock and inventory
              information, uploaded files, generated reports, and other
              business-related data entered by the user during the use of the
              App.
            </Text>
            <Text
              variant="bodyMedium"
              style={[styles.paragraph, { marginTop: 8 }]}
            >
              In addition, the App may automatically collect certain technical
              and device-related information including IP address, browser type,
              operating system, Location, device identifiers, login activity,
              application version, crash reports, access timestamps, network
              information, session logs, and usage analytics for operational,
              security, troubleshooting, and service improvement purposes.
            </Text>
          </View>

          {/* Use of Information */}
          <View style={styles.section}>
            <Text variant="titleMedium" style={styles.sectionTitle}>
              Use of Information
            </Text>
            <Text variant="bodyMedium" style={styles.paragraph}>
              The information collected through the App may be used for
              operating, maintaining, managing, improving, and providing the
              services offered through the platform. Such use may include
              account creation and management, invoice and report generation,
              billing operations, inventory management, customer support,
              subscription management, payment processing, communication
              regarding updates or service-related notices, security
              verification, fraud detection, troubleshooting, analytics, system
              monitoring, backup management, and technical support.
            </Text>
          </View>

          {/* Data Sharing */}
          <View style={styles.section}>
            <Text variant="titleMedium" style={styles.sectionTitle}>
              Data Sharing
            </Text>
            <Text variant="bodyMedium" style={styles.paragraph}>
              The Company might Share, sell, rent, or commercially trade
              personal or business data of users to unrelated third parties for
              marketing purposes. However, the Company may share, disclose,
              transfer, or provide access to certain information where
              reasonably necessary for operation, maintenance, security, legal
              compliance, or delivery of services associated with the App.
            </Text>
            <Text
              variant="bodyMedium"
              style={[styles.paragraph, { marginTop: 8 }]}
            >
              Such sharing may include cloud hosting providers, payment gateway
              operators, SMS or email service providers, analytics providers,
              technical infrastructure partners, customer support systems, data
              storage vendors, integration partners, security service providers,
              consultants, auditors, or other third-party vendors engaged for
              legitimate operational purposes.
            </Text>
          </View>

          {/* 2. Nature of Service */}
          <View style={styles.section}>
            <Text variant="titleMedium" style={styles.sectionTitle}>
              2. Nature of the Service
            </Text>
            <View style={styles.bulletList}>
              <Text variant="bodyMedium" style={styles.bulletPoint}>
                • <Text style={styles.bold}>Software Platform Only:</Text> The
                App is a software-based technology platform developed strictly
                to assist users in managing business operations digitally. The
                Company only provides software tools and related technical
                services.
              </Text>
              <Text variant="bodyMedium" style={styles.bulletPoint}>
                • <Text style={styles.bold}>No Professional Advice:</Text> The
                Company does not act as a chartered accountant, auditor, tax
                consultant, legal advisor, GST practitioner, financial advisor,
                or government-authorized compliance agency.
              </Text>
              <Text variant="bodyMedium" style={styles.bulletPoint}>
                • <Text style={styles.bold}>System-Generated Outputs:</Text> The
                reports, invoices, GST calculations, stock summaries, accounting
                figures, analytics, and financial records generated through the
                App are system-generated outputs based entirely on the data
                entered, modified, imported, or deleted by the user. The Company
                does not independently verify, validate, audit, or guarantee the
                correctness, legality, completeness, or accuracy of such data or
                reports.
              </Text>
              <Text variant="bodyMedium" style={styles.bulletPoint}>
                • <Text style={styles.bold}>No Compliance Guarantee:</Text> Use
                of the App does not guarantee compliance with GST laws, tax
                laws, accounting standards, audit requirements, or any
                government regulations applicable to the user's business or
                jurisdiction.
              </Text>
            </View>
          </View>

          {/* 3. User Responsibility */}
          <View style={styles.section}>
            <Text variant="titleMedium" style={styles.sectionTitle}>
              3. User Responsibility
            </Text>
            <View style={styles.bulletList}>
              <Text variant="bodyMedium" style={styles.bulletPoint}>
                • <Text style={styles.bold}>Sole Accountability:</Text> The user
                shall remain fully and solely responsible for all activities
                conducted through the App, including but not limited to invoice
                creation, bill generation, GST entries, stock adjustments,
                purchase management, sales management, customer records,
                supplier records, payment records, accounting entries, report
                generation, and tax-related calculations.
              </Text>
              <Text variant="bodyMedium" style={styles.bulletPoint}>
                • <Text style={styles.bold}>Mandatory Data Verification:</Text>{' '}
                The user is solely responsible for verifying all data before
                issuing invoices, filing taxes, sharing reports, printing
                documents, or using generated records for official, legal,
                accounting, taxation, banking, or audit purposes.
              </Text>
              <Text variant="bodyMedium" style={styles.bulletPoint}>
                • <Text style={styles.bold}>Prohibited Conduct:</Text> The user
                agrees not to use the App for any illegal, fraudulent,
                misleading, harmful, unauthorized, or prohibited activity,
                including but not limited to fake invoicing, tax evasion, money
                laundering, unauthorized data collection, cyber abuse, financial
                fraud, or misuse of customer information.
              </Text>
            </View>
          </View>

          {/* Device Information */}
          <View style={styles.section}>
            <Text variant="titleMedium" style={styles.sectionTitle}>
              Device Information
            </Text>
            <Text variant="bodyMedium" style={styles.paragraph}>
              In order to provide secure, reliable, and efficient access to the
              App and related services, the Company may automatically collect
              certain technical and device-related information including IP
              address, registered mobile number, device identifiers, operating
              system details, browser type, device configuration, network
              information, approximate geo-location data, Messages, application
              version, login activity, and other technical identifiers generated
              during use of the App.
            </Text>
          </View>

          {/* Location and Device Access */}
          <View style={styles.section}>
            <Text variant="titleMedium" style={styles.sectionTitle}>
              Location and Device Access Information
            </Text>
            <Text variant="bodyMedium" style={styles.paragraph}>
              Where necessary for service functionality, security verification,
              fraud prevention, regulatory compliance, or location-based
              features, the Company may collect, access, process, or use certain
              device and location-related information. By using the App, the
              user expressly consents to the collection and processing of such
              location and device-related information to the extent permitted
              under applicable laws and device permissions granted by the user.
            </Text>
          </View>

          {/* 4. GST and Taxation */}
          <View style={styles.section}>
            <Text variant="titleMedium" style={styles.sectionTitle}>
              4. GST, Taxation, and Compliance Disclaimer
            </Text>
            <View style={styles.bulletList}>
              <Text variant="bodyMedium" style={styles.bulletPoint}>
                • <Text style={styles.bold}>Convenience Features Only:</Text>{' '}
                The App may provide GST-related calculations, tax summaries,
                HSN/SAC support, invoice formats, and tax reports for user
                convenience. However, the Company does not guarantee that such
                calculations or formats comply with the latest government
                notifications or legal amendments.
              </Text>
              <Text variant="bodyMedium" style={styles.bulletPoint}>
                •{' '}
                <Text style={styles.bold}>
                  Independent Verification Required:
                </Text>{' '}
                Users are advised to independently verify all GST rates, tax
                calculations, invoice structures, and accounting records with
                qualified professionals before official use or government
                submission.
              </Text>
              <Text variant="bodyMedium" style={styles.bulletPoint}>
                • <Text style={styles.bold}>Exclusion of Tax Liability:</Text>{' '}
                The Company shall not be liable for any GST disputes, tax
                penalties, late fees, interest, legal notices, departmental
                actions, audit objections, filing errors, or financial losses
                arising from the use of the App.
              </Text>
            </View>
          </View>

          {/* 5. Data Accuracy */}
          <View style={styles.section}>
            <Text variant="titleMedium" style={styles.sectionTitle}>
              5. Data Accuracy and Generated Reports
            </Text>
            <View style={styles.bulletList}>
              <Text variant="bodyMedium" style={styles.bulletPoint}>
                • <Text style={styles.bold}>Dependency on User Input:</Text> All
                invoices, reports, stock statements, ledgers, summaries,
                analytics, and other outputs generated by the App are dependent
                upon user-provided information. The Company does not guarantee
                the completeness, reliability, legality, accuracy, or
                suitability of any generated data or report.
              </Text>
              <Text variant="bodyMedium" style={styles.bulletPoint}>
                • <Text style={styles.bold}>Software Limitations:</Text> Users
                acknowledge that software systems may occasionally contain bugs,
                technical limitations, rounding differences, synchronization
                issues, or calculation discrepancies. All generated reports and
                invoices must be independently verified before business or legal
                use.
              </Text>
              <Text variant="bodyMedium" style={styles.bulletPoint}>
                •{' '}
                <Text style={styles.bold}>
                  No Liability for Business Disruptions:
                </Text>{' '}
                The Company shall not be responsible for business losses,
                accounting mismatches, stock differences, incorrect reports,
                duplicate records, accidental deletions, or financial damages
                caused by system usage or user actions.
              </Text>
            </View>
          </View>

          {/* 6. Data Storage */}
          <View style={styles.section}>
            <Text variant="titleMedium" style={styles.sectionTitle}>
              6. Data Storage, Security, and Backup
            </Text>
            <View style={styles.bulletList}>
              <Text variant="bodyMedium" style={styles.bulletPoint}>
                • <Text style={styles.bold}>Security Efforts:</Text> The Company
                implements commercially reasonable technical and organizational
                security measures to protect user information. However, no
                software platform or electronic storage system can guarantee
                absolute security or complete protection against cyber threats.
              </Text>
              <Text variant="bodyMedium" style={styles.bulletPoint}>
                • <Text style={styles.bold}>Risk of Data Loss:</Text> Users
                understand and agree that data may be affected by technical
                errors, server failures, internet interruptions, unauthorized
                access, hacking attempts, malware attacks, hardware failures, or
                events beyond reasonable control.
              </Text>
              <Text variant="bodyMedium" style={styles.bulletPoint}>
                •{' '}
                <Text style={styles.bold}>Mandatory Independent Backups:</Text>{' '}
                The user remains solely responsible for maintaining independent
                backups of all critical business records, invoices, customer
                data, tax records, and reports. The Company shall not be liable
                for permanent or temporary data loss or restoration failures.
              </Text>
            </View>
          </View>

          {/* 7. Third-Party Services */}
          <View style={styles.section}>
            <Text variant="titleMedium" style={styles.sectionTitle}>
              7. Third-Party Services and Integrations
            </Text>
            <View style={styles.bulletList}>
              <Text variant="bodyMedium" style={styles.bulletPoint}>
                • <Text style={styles.bold}>Dependence on Third Parties:</Text>{' '}
                The App may integrate with third-party services such as payment
                gateways, cloud hosting providers, SMS services, WhatsApp
                services, email services, or analytics tools. Such third-party
                services operate independently under their own terms and privacy
                policies.
              </Text>
              <Text variant="bodyMedium" style={styles.bulletPoint}>
                •{' '}
                <Text style={styles.bold}>No Control Over Third Parties:</Text>{' '}
                The Company does not control and shall not be responsible for
                third-party downtime, interruptions, service failures, data
                breaches, or security incidents arising from third-party systems
                or integrations.
              </Text>
            </View>
          </View>

          {/* 8. Subscription and Payments */}
          <View style={styles.section}>
            <Text variant="titleMedium" style={styles.sectionTitle}>
              8. Subscription, Payments, and Refund Policy
            </Text>
            <View style={styles.bulletList}>
              <Text variant="bodyMedium" style={styles.bulletPoint}>
                • <Text style={styles.bold}>Advance Payments:</Text> Certain
                features of the App may require payment of subscription fees,
                renewal charges, or service charges. By purchasing any paid
                plan, the user agrees to pay all applicable charges in advance.
              </Text>
              <Text variant="bodyMedium" style={styles.bulletPoint}>
                • <Text style={styles.bold}>Strict No-Refund Policy:</Text>{' '}
                Unless otherwise required under applicable law, all payments
                made to the Company shall be non-refundable, non-transferable,
                and non-cancellable. Failure to pay subscription fees may result
                in restricted access, suspension, or permanent termination of
                services.
              </Text>
              <Text variant="bodyMedium" style={styles.bulletPoint}>
                • <Text style={styles.bold}>Pricing Revisions:</Text> The
                Company reserves the right to revise pricing, subscription
                structures, renewal policies, and feature availability at any
                time without prior individual notice.
              </Text>
            </View>
          </View>

          {/* Payment Information */}
          <View style={styles.section}>
            <Text variant="titleMedium" style={styles.sectionTitle}>
              Payment Information and Card Security
            </Text>
            <Text variant="bodyMedium" style={styles.paragraph}>
              The Company does not collect, store, retain, process, or maintain
              sensitive card-related authentication data such as CVV numbers,
              card PINs, full debit or credit card details, ATM credentials, or
              banking passwords on its servers. Payment transactions, where
              applicable, may be processed through authorized third-party
              payment gateway providers operating under their own security
              standards and privacy policies.
            </Text>
          </View>

          {/* 9. Intellectual Property */}
          <View style={styles.section}>
            <Text variant="titleMedium" style={styles.sectionTitle}>
              9. Intellectual Property Rights
            </Text>
            <View style={styles.bulletList}>
              <Text variant="bodyMedium" style={styles.bulletPoint}>
                • <Text style={styles.bold}>Exclusive Ownership:</Text> All
                software, source code, system architecture, databases, user
                interface designs, layouts, graphics, logos, trademarks, trade
                names, reports, workflows, features, and related intellectual
                property associated with the App are the exclusive property of
                the Company and its licensors.
              </Text>
              <Text variant="bodyMedium" style={styles.bulletPoint}>
                • <Text style={styles.bold}>Prohibited Actions:</Text> Users are
                strictly prohibited from copying, modifying, distributing,
                reverse engineering, extracting source code, reselling,
                sublicensing, reproducing, publishing, or commercially
                exploiting any portion of the App without prior written
                permission.
              </Text>
              <Text variant="bodyMedium" style={styles.bulletPoint}>
                • <Text style={styles.bold}>Legal Enforcement:</Text>{' '}
                Unauthorized use of the App or its intellectual property may
                result in civil liability, criminal prosecution, legal
                proceedings, and permanent termination of access.
              </Text>
            </View>
          </View>

          {/* 10. Suspension and Termination */}
          <View style={styles.section}>
            <Text variant="titleMedium" style={styles.sectionTitle}>
              10. Suspension and Termination of Services
            </Text>
            <View style={styles.bulletList}>
              <Text variant="bodyMedium" style={styles.bulletPoint}>
                • <Text style={styles.bold}>Right to Terminate:</Text> The
                Company reserves the absolute right to suspend, restrict,
                disable, or terminate user access to the App, temporarily or
                permanently, without prior notice, if the Company reasonably
                believes that the user has violated these Terms, engaged in
                suspicious activities, caused security risks, or misused the
                platform in any manner.
              </Text>
              <Text variant="bodyMedium" style={styles.bulletPoint}>
                • <Text style={styles.bold}>Surviving Liabilities:</Text>{' '}
                Termination or suspension of access shall not affect any
                existing liabilities, payment obligations, legal rights, or
                claims arising before such termination.
              </Text>
            </View>
          </View>

          {/* 11. As Is Disclaimer */}
          <View style={styles.section}>
            <Text variant="titleMedium" style={styles.sectionTitle}>
              11. "As Is" and "As Available" Disclaimer
            </Text>
            <View style={styles.bulletList}>
              <Text variant="bodyMedium" style={styles.bulletPoint}>
                • <Text style={styles.bold}>No Assurances:</Text> The App and
                all related services are provided on an "As Is" and "As
                Available" basis without any warranties, guarantees,
                representations, or assurances of any kind, whether express,
                implied, statutory, or otherwise.
              </Text>
              <Text variant="bodyMedium" style={styles.bulletPoint}>
                • <Text style={styles.bold}>Assumption of Risk:</Text> By using
                the App, the user agrees that use of the software is entirely at
                the user's own risk and discretion. The Company expressly
                disclaims all warranties including implied warranties of
                merchantability, fitness for a particular purpose,
                non-infringement, availability, reliability, and security.
              </Text>
            </View>
          </View>

          {/* 12. Limitation of Liability */}
          <View style={styles.section}>
            <Text variant="titleMedium" style={styles.sectionTitle}>
              12. Limitation of Liability
            </Text>
            <View style={styles.bulletList}>
              <Text variant="bodyMedium" style={styles.bulletPoint}>
                • <Text style={styles.bold}>Maximum Exclusion:</Text> To the
                maximum extent permitted under applicable law, the Company, its
                owners, directors, employees, developers, affiliates,
                consultants, licensors, service providers, agents, and partners
                shall not be liable for any direct, indirect, incidental,
                consequential, special, exemplary, punitive, or financial
                damages arising from or related to the use of the App.
              </Text>
              <Text variant="bodyMedium" style={styles.bulletPoint}>
                • <Text style={styles.bold}>Scope of Excluded Losses:</Text>{' '}
                This limitation includes but is not limited to losses relating
                to business interruption, tax penalties, audit disputes,
                accounting errors, loss of profits, loss of goodwill, data
                breaches, system downtime, invoice disputes, incorrect
                calculations, software bugs, unauthorized access, third-party
                failures, or financial losses.
              </Text>
            </View>
          </View>

          {/* 13. Indemnification */}
          <View style={styles.section}>
            <Text variant="titleMedium" style={styles.sectionTitle}>
              13. Indemnification
            </Text>
            <Text variant="bodyMedium" style={styles.paragraph}>
              The user agrees to fully indemnify, defend, and hold harmless the
              Company, its owners, employees, developers, affiliates, and
              representatives from and against any claims, liabilities, damages,
              penalties, actions, proceedings, losses, expenses, or legal costs
              (including reasonable attorney fees) arising from the user's
              actions, misuse of the App, violation of laws, incorrect records,
              customer disputes, GST disputes, tax disputes, fraudulent
              activities, or breach of these Terms & Conditions.
            </Text>
          </View>

          {/* Force Majeure */}
          <View style={styles.section}>
            <Text variant="titleMedium" style={styles.sectionTitle}>
              Force Majeure Clause
            </Text>
            <Text variant="bodyMedium" style={styles.paragraph}>
              The Company shall not be liable for any delay, interruption,
              failure, or inability to perform obligations due to causes beyond
              reasonable control including natural disasters, floods, fire,
              cyber attacks, power failures, internet outages, government
              actions, war, labor disputes, pandemics, or failures of
              third-party infrastructure or services.
            </Text>
          </View>

          {/* 14. Changes to Terms */}
          <View style={styles.section}>
            <Text variant="titleMedium" style={styles.sectionTitle}>
              14. Changes to Terms and Services
            </Text>
            <Text variant="bodyMedium" style={styles.paragraph}>
              The Company reserves the right to modify, update, discontinue,
              suspend, or change any part of the App, features, pricing,
              policies, or these Terms & Conditions at any time without prior
              notice. Continued use of the App after such changes shall
              constitute explicit acceptance of the revised Terms.
            </Text>
          </View>

          {/* 15. Governing Law */}
          <View style={styles.section}>
            <Text variant="titleMedium" style={styles.sectionTitle}>
              15. Governing Law and Jurisdiction
            </Text>
            <Text variant="bodyMedium" style={styles.paragraph}>
              These Terms & Conditions shall be governed by and interpreted in
              accordance with the laws of <Text style={styles.bold}>India</Text>
              . Any disputes arising out of or relating to the App, services, or
              these Terms shall be subject to the exclusive jurisdiction of the
              courts located in{' '}
              <Text style={styles.bold}>Kolkata, West Bengal, India</Text>.
            </Text>
          </View>

          {/* 16. Contact */}
          <View style={[styles.section, styles.lastSection]}>
            <Text variant="titleMedium" style={styles.sectionTitle}>
              16. Contact Information
            </Text>
            <Text variant="bodyMedium" style={styles.paragraph}>
              For support, privacy concerns, or official communication, users
              may contact:
            </Text>
            <View
              style={[
                styles.contactBox,
                {
                  backgroundColor: theme.colors.surfaceVariant,
                  borderLeftColor: theme.colors.primary,
                },
              ]}
            >
              <Text variant="bodyMedium" style={styles.contactText}>
                🏢 Company Name: AMP Technology
              </Text>
              <Text variant="bodyMedium" style={styles.contactText}>
                📧 Email: Sales@amdaani.com
              </Text>
              <Text variant="bodyMedium" style={styles.contactText}>
                📧 Support: Support@amdaani.com
              </Text>
            </View>
          </View>

          {/* Agreement Notice */}
          {showAcceptButton && (
            <View
              style={[
                styles.agreementNotice,
                {
                  backgroundColor: theme.colors.surfaceVariant,
                  borderColor: theme.colors.primary,
                },
              ]}
            >
              <Text variant="bodySmall" style={styles.agreementText}>
                ✓ By clicking "I Accept", you acknowledge that you have read,
                understood, and agree to be bound by these Terms and Conditions.
              </Text>
            </View>
          )}

          {/* Extra space for footer */}
          {showAcceptButton && <View style={{ height: 100 }} />}
        </View>
      </BaseBottomSheet>
    );
  },
);

const styles = StyleSheet.create({
  contentContainer: {
    paddingBottom: 0,
  },
  container: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 20,
  },
  updatedText: {
    fontStyle: 'italic',
    marginBottom: 12,
  },
  divider: {
    marginBottom: 20,
  },
  section: {
    marginBottom: 24,
  },
  lastSection: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontWeight: '700',
    marginBottom: 12,
    letterSpacing: 0.2,
  },
  paragraph: {
    lineHeight: 22,
    textAlign: 'justify',
  },
  bold: {
    fontWeight: '700',
  },
  bulletList: {
    marginTop: 8,
    marginLeft: 8,
  },
  bulletPoint: {
    lineHeight: 24,
    marginBottom: 6,
  },
  contactBox: {
    borderRadius: 12,
    padding: 16,
    marginTop: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#667eea',
  },
  contactText: {
    marginBottom: 8,
    fontWeight: '500',
  },
  agreementNotice: {
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#bfdbfe',
    marginTop: 16,
    marginBottom: 16,
  },
  agreementText: {
    textAlign: 'center',
    fontWeight: '600',
    lineHeight: 20,
  },

  // Footer Styles
  footerContainer: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
    borderTopWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 10,
  },
  acceptButtonWrapper: {
    width: '100%',
  },
  acceptButton: {
    height: 56,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#667eea',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 8,
  },
  acceptButtonText: {
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
});

TermsBottomSheet.displayName = 'TermsBottomSheet';

export default TermsBottomSheet;
