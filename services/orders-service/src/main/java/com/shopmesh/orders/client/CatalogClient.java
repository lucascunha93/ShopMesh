package com.shopmesh.orders.client;

import com.shopmesh.orders.exception.CatalogServiceUnavailableException;
import com.shopmesh.orders.exception.ProductNotFoundException;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatusCode;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

@Component
public class CatalogClient {
    private final RestClient restClient;

    public CatalogClient(RestClient.Builder builder,
                         @Value("${catalog.service-url}") String catalogServiceUrl) {
        this.restClient = builder.baseUrl(catalogServiceUrl).build();
    }

    public CatalogProduct getProduct(String productId) {
        try {
            CatalogProductResponse response = restClient.get()
                    .uri("/products/{id}", productId)
                    .retrieve()
                    .onStatus(status -> status.value() == 404,
                            (request, result) -> {
                                throw new ProductNotFoundException(productId);
                            })
                    .onStatus(HttpStatusCode::is5xxServerError,
                            (request, result) -> {
                                throw new CatalogServiceUnavailableException();
                            })
                    .body(CatalogProductResponse.class);

            if (response == null || response.product() == null) {
                throw new CatalogServiceUnavailableException();
            }
            return response.product();
        } catch (ProductNotFoundException | CatalogServiceUnavailableException exception) {
            throw exception;
        } catch (RestClientException exception) {
            throw new CatalogServiceUnavailableException(exception);
        }
    }
}
