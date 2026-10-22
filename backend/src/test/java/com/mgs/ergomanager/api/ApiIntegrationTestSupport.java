package com.mgs.ergomanager.api;

import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;

import com.jayway.jsonpath.JsonPath;
import com.mgs.ergomanager.model.Availability;
import com.mgs.ergomanager.model.Company;
import com.mgs.ergomanager.model.Form;
import com.mgs.ergomanager.model.Question;
import com.mgs.ergomanager.model.SelfEvaluation;
import com.mgs.ergomanager.model.User;
import com.mgs.ergomanager.model.enums.RiskLevel;
import com.mgs.ergomanager.model.enums.Role;
import com.mgs.ergomanager.repository.AvailabilityRepository;
import com.mgs.ergomanager.repository.CompanyRepository;
import com.mgs.ergomanager.repository.FormRepository;
import com.mgs.ergomanager.repository.QuestionRepository;
import com.mgs.ergomanager.repository.SelfEvaluationRepository;
import com.mgs.ergomanager.repository.UserRepository;
import com.mgs.ergomanager.service.EmailService;
import java.io.UnsupportedEncodingException;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.request.RequestPostProcessor;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.context.WebApplicationContext;
import tools.jackson.databind.json.JsonMapper;

/**
 * Shared setup of the API integration tests: real security chain, H2, and
 * every test rolled back. The authenticated users are persisted, so the
 * ownership rules can find them by email.
 */
@SpringBootTest
@ActiveProfiles("test")
@Transactional
abstract class ApiIntegrationTestSupport {

    /** Format sent by the Angular application for the date query parameters. */
    protected static final DateTimeFormatter QUERY_DATE_FORMAT = DateTimeFormatter.ofPattern("yyyy-MM-dd'T'HH:mm:ss");

    @Autowired
    protected WebApplicationContext context;

    @Autowired
    protected UserRepository userRepository;

    @Autowired
    protected CompanyRepository companyRepository;

    @Autowired
    protected FormRepository formRepository;

    @Autowired
    protected QuestionRepository questionRepository;

    @Autowired
    protected SelfEvaluationRepository selfEvaluationRepository;

    @Autowired
    protected AvailabilityRepository availabilityRepository;

    @Autowired
    protected PasswordEncoder passwordEncoder;

    @MockitoBean
    protected EmailService emailService;
    protected final JsonMapper json = JsonMapper.builder().build();
    protected MockMvc mvc;

    @BeforeEach
    void setUpMockMvc() {
        mvc = MockMvcBuilders.webAppContextSetup(context).apply(springSecurity()).build();
    }

    protected User persistUser(String email, Role role) {
        User user = new User();
        user.setFirstName("Nombre");
        user.setFirstLastName(role == Role.ADMIN ? "Admin" : "Ergo");
        user.setEmail(email);
        user.setPassword(passwordEncoder.encode("Original123!"));
        user.setRole(role);
        user.setActive(true);
        return userRepository.saveAndFlush(user);
    }

    protected Company persistCompany(String businessName, String taxId, boolean active) {
        Company company = new Company();
        company.setBusinessName(businessName);
        company.setTaxId(taxId);
        company.setContactEmail("contacto@" + taxId.replace("-", "") + ".test");
        company.setActive(active);
        return companyRepository.saveAndFlush(company);
    }

    /** Persists an active form whose questions have the given weights, in order. */
    protected Form persistForm(String title, int... weights) {
        Form form = new Form();
        form.setTitle(title);
        form.setPublicationYear(2026);
        form.setActive(true);
        formRepository.saveAndFlush(form);
        List<Question> questions = new ArrayList<>();
        for (int index = 0; index < weights.length; index++) {
            Question question = new Question();
            question.setForm(form);
            question.setStatement("Pregunta " + (index + 1));
            question.setQuestionOrder(index + 1);
            question.setWeight(weights[index]);
            questions.add(question);
        }
        questionRepository.saveAllAndFlush(questions);
        return form;
    }

    protected List<Question> questionsOf(Form form) {
        return questionRepository.findByFormIdAndActiveTrueOrderByQuestionOrderAsc(form.getId());
    }

    protected SelfEvaluation persistSelfEvaluation(Form form, Company company, String email) {
        SelfEvaluation selfEvaluation = new SelfEvaluation();
        selfEvaluation.setForm(form);
        selfEvaluation.setCompany(company);
        selfEvaluation.setEmployeeName("Colaborador");
        selfEvaluation.setEmployeeEmail(email);
        selfEvaluation.setTotalScore(0);
        selfEvaluation.setRiskLevel(RiskLevel.LOW);
        return selfEvaluationRepository.saveAndFlush(selfEvaluation);
    }

    protected Availability persistAvailability(User ergonomist, LocalDateTime start, LocalDateTime end) {
        Availability availability = new Availability();
        availability.setUser(ergonomist);
        availability.setStartDateTime(start);
        availability.setEndDateTime(end);
        return availabilityRepository.saveAndFlush(availability);
    }

    /** Authenticates the request as a persisted user, the way the JWT filter would. */
    protected static RequestPostProcessor as(User user) {
        return user(user.getEmail()).roles(user.getRole().name());
    }

    protected String toJson(Object value) {
        return json.writeValueAsString(value);
    }

    protected static long idOf(MvcResult result) throws UnsupportedEncodingException {
        return ((Number) JsonPath.read(result.getResponse().getContentAsString(), "$.id")).longValue();
    }

    protected static <T> T read(MvcResult result, String path) throws UnsupportedEncodingException {
        return JsonPath.read(result.getResponse().getContentAsString(), path);
    }

    /** A whole hour some days ahead, so date comparisons are stable. */
    protected static LocalDateTime futureAt(int daysAhead, int hour) {
        return LocalDateTime.now().plusDays(daysAhead).withHour(hour).withMinute(0).withSecond(0).withNano(0);
    }
}
